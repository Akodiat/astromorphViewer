import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {displayImageAndData} from "./utils.js";
import {colorClasses} from "./lut.js";

// Initialise pointer vector once and reuse
const pointer = new THREE.Vector2();

// Initialise raycaster once and reuse
const raycaster = new THREE.Raycaster();

// Load a default map
const defaultMap = new THREE.TextureLoader().load(
    "resources/placeholderSprite.png",
    texture => texture.colorSpace = THREE.SRGBColorSpace
);

class SpriteView {
    constructor(canvas, umapResults, fitsManager) {
        this.fitsManager = fitsManager;
        this.umapResults = umapResults;

        this.canvas = canvas;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        //this.camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.11, 20);
        this.camera = new THREE.OrthographicCamera(
            canvas.width / - 2,
            canvas.width / 2,
            canvas.height / 2,
            canvas.height / - 2,
            0.1, 20
        );

        let xmin = Infinity;
        let ymin = Infinity;
        let xmax = -Infinity;
        let ymax = -Infinity;

        for (const r of umapResults) {
            xmin = Math.min(xmin, r.umap_x);
            ymin = Math.min(ymin, r.umap_y);
            xmax = Math.max(xmax, r.umap_x);
            ymax = Math.max(ymax, r.umap_y);
        }

        const aspect = canvas.width / canvas.height;

        if (aspect > 1) {
            this.camera.zoom = canvas.height / (ymax-ymin);
        } else {
            this.camera.zoom = canvas.width / (xmax-xmin);
        }

        this.camera.position.set(0, 0, 10);
        //this.camera.zoom = 50;
        this.camera.updateProjectionMatrix();

        this.scene = new THREE.Scene();

        this.controls = new OrbitControls(this.camera, canvas);

        this.controls.enableRotate = false;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN
        };
        this.controls.touches = {
            ONE: THREE.TOUCH.PAN,
	        TWO: THREE.TOUCH.DOLLY_PAN
        }

        // Render whenever camera is moved
        this.controls.addEventListener("change", ()=>this.render());

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: canvas,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(canvas.width, canvas.height);

        this.particleMap = new Map();

        //

        window.addEventListener('resize', ()=> {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.camera.aspect = this.canvas.width / this.canvas.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.canvas.width, this.canvas.height);
            this.render();
        });

        canvas.addEventListener("click", event => this.onClick(event));

        this.initSpritesFromUmap();

        const mapScalingFactor = document.getElementById("mapScalingFactor");

        mapScalingFactor.addEventListener("change", () => {
            for (const s of this.sprites.children) {
                if (s.material.map !== defaultMap) {
                    s.material.size = s.material.canvasSize * parseFloat(mapScalingFactor.value);
                }
            }
            this.render();
        });
    }

    updateUmapPositions(newUmap) {
        this.umapResults = newUmap;
        for (let i=0; i<newUmap.length; i++) {
            const r = this.umapResults[i];
            const geometry = this.sprites.children[i].geometry;
            const vertices = [];
            vertices.push(
                r.umap_x,
                r.umap_y,
                r.umap_z ?? 0
            );
            const posAttr = new THREE.Float32BufferAttribute(vertices, 3);
            geometry.setAttribute('position', posAttr);
            posAttr.needsUpdate = true;
        }
        this.render();
    }

    initSpritesFromUmap() {
        this.sprites = new THREE.Group();
        this.scene.add(this.sprites);

        const colors = new Map();
        [...new Set(this.umapResults.map(v=>v.cluster))].forEach((v, i) => {
            // Clusters seem to be integers from 0-n, but don't assume
            colors.set(v, colorClasses[i]);
        });

        for (let i=0; i<this.umapResults.length; i++) {
            const r = this.umapResults[i];
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            vertices.push(
                r.umap_x,
                r.umap_y,
                r.umap_z ?? 0
            );
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

            const material = new THREE.PointsMaterial({
                size: 5,
                color: colors.get(r.cluster),
                blending: THREE.NormalBlending,
                map: defaultMap,
                depthTest: false,
                transparent: true,
                sizeAttenuation: false
            });

            // Save cluster color separately
            // (to not be overwritten by selection)
            material.clusterColor = material.color.clone();

            const particle = new THREE.Points(geometry, material);

            this.particleMap.set(particle, r);

            this.sprites.add(particle);
        }

        this.render();
    }

    async spriteImagesFromFits() {
        const colorScale = "grayscale";
        const progress = document.getElementById("mapProgress");
        progress.max = this.umapResults.length;
        progress.hidden = false;

        for (let i=0; i<this.umapResults.length; i++) {
            progress.value = i;

            const r = this.umapResults[i];
            const fileName = r.filepath.split("/").slice(-1)[0];
            const data = this.fitsManager.imageData.get(fileName);
            if (data === undefined) {
                console.warn(`Missing fits file: ${fileName}`);
                continue;
            }

            const material = this.sprites.children[i].material;

            const drawFromData = colorData => {
                material.canvasSize = data.width;
                const size = material.canvasSize * parseFloat(document.getElementById("mapScalingFactor").value);

                drawImage(colorData, data, size, material);
                this.render();
            }

            // Get color data, then draw. Do at most 10 parallel fits loads,
            // to avoid locking the browser
            if (i % 10 === 0) {
                // Wait for data to load, then draw
                const colorData = await this.fitsManager.colorFromData(
                    data, colorScale, true
                );
                drawFromData(colorData);

            } else {
                // Draw when data has loaded (asynchronously)
                this.fitsManager.colorFromData(
                    data, colorScale, true
                ).then(drawFromData);
            }
        }
        this.render();

        progress.hidden = true;
    }


    onClick(event) {
        if (this.selectedObject) {
            this.selectedObject.material.color.copy(
                this.selectedObject.material.clusterColor
            );
            this.selectedObject = null;
        }

        // Calculate mouse position
        //const rect = this.canvas.getBoundingClientRect()
        //pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        //pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        pointer.x = (event.offsetX / this.canvas.width) * 2 - 1;
        pointer.y = -(event.offsetY / this.canvas.height) * 2 + 1;

        console.log(`x = ${pointer.x}, y=${pointer.y}`);

        raycaster.setFromCamera(pointer, this.camera);

        const intersects = raycaster.intersectObject(this.sprites, true);

        if (intersects.length > 0) {
            const intersectedPositions = intersects.map(r=>{
                const p = r.object.geometry.getAttribute("position").array;
                return new THREE.Vector2(p[0], p[1]);
            });

            const target = new THREE.Vector2(
                raycaster.ray.origin.x,
                raycaster.ray.origin.y,
            );

            let closest;
            let minDistSq = Infinity;
            for (let i=0, l=intersectedPositions.length; i<l; i++) {
                const distSq = intersectedPositions[i].distanceToSquared(target);
                if (distSq < minDistSq) {
                    closest = intersects[i];
                    minDistSq = distSq;
                }
            }

            this.selectedObject = closest.object;
            this.selectedObject.material.color.set('#00a6ff');

            displayImageAndData(
                this.particleMap.get(this.selectedObject),
                this.fitsManager
            );
        }
        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}


function drawImage(colorData, data, size, material) {
    const imgData = new ImageData(
        colorData, data.width, data.height
    );

    const canvas = document.createElement("canvas");
    canvas.width = data.width;
    canvas.height = data.height;
    var context = canvas.getContext("2d");

    context.putImageData(imgData, 0, 0);

    const map = new THREE.CanvasTexture(canvas);
    map.center = new THREE.Vector2(0.5, 0.5);

    material.map = map;
    material.size = size;
}

export {SpriteView}