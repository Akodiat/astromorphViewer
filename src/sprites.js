import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

import {displayImageAndData} from "./utils.js";
import {getClosestOpaque} from "./utils.js";

// Initialise pointer vector once and reuse
const pointer = new THREE.Vector2();

// Initialise raycaster once and reuse
const raycaster = new THREE.Raycaster();

class SpriteView {
    constructor(canvas, umapResults, fitsManager) {
        this.fitsManager = fitsManager;

        this.canvas = canvas;
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = 1000;
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
            this.canvas.width = this.canvas.parentElement.clientWidth;
            this.camera.aspect = this.canvas.width / this.canvas.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.canvas.width, this.canvas.height);
            this.render();
        });

        canvas.addEventListener("click", event => this.onClick(event));

        this.spritesFromData(umapResults, fitsManager).then(()=>this.render());

        const mapScalingFactor = document.getElementById("mapScalingFactor");

        mapScalingFactor.addEventListener("change", () => {
            for (const s of this.sprites.children) {
                s.material.size = s.material.canvasSize * parseFloat(mapScalingFactor.value);
            }
            this.render();
        });
    }

    async spritesFromData(umapResults, fitsManager) {
        const progress = document.getElementById("mapProgress");
        progress.max = umapResults.length;
        progress.hidden = false;

        this.sprites = new THREE.Group();
        this.scene.add(this.sprites);

        for (let i=0; i<umapResults.length; i++) {
            progress.value = i;
            const r = umapResults[i];
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            vertices.push(
                r.umap_x,
                r.umap_y,
                0
            );
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

            const fileName = r.filepath.split("/").slice(-1)[0];
            const data = fitsManager.imageData.get(fileName);

            if (data === undefined) {
                console.warn(`Missing fits file: ${fileName}`);
                continue;
            }


            const drawImage = colorData => {
                const imgData = new ImageData(
                    colorData, data.width, data.height
                );

                const canvas = document.createElement("canvas");
                canvas.width = data.width;
                canvas.height = data.height;
                var context = canvas.getContext("2d");

                context.putImageData(imgData, 0, 0);

                const size = data.width * parseFloat(document.getElementById("mapScalingFactor").value);

                const map = new THREE.CanvasTexture(canvas);
                map.center = new THREE.Vector2(0.5, 0.5);

                const material = new THREE.PointsMaterial({
                    size: size,
                    //color: new THREE.Color().setRGB(Math.random(), Math.random, Math.random()),
                    map: map,
                    blending: THREE.NormalBlending,
                    depthTest: false,
                    transparent: true,
                    sizeAttenuation: true
                });
                material.canvasSize = data.width;

                const particle = new THREE.Points(geometry, material);

                this.particleMap.set(particle, r);

                this.sprites.add(particle);
                this.render();
            }

            // Get color data, then draw. Do at most 10 parallel fits loads,
            // to avoid locking the browser
            if (i % 10 === 0) {
                // Wait for data to load, then draw
                const colorData = await fitsManager.colorFromData(
                    data, "viridis", true
                );
                drawImage(colorData);
            } else {
                // Draw when data has loaded (asynchronously)
                fitsManager.colorFromData(
                    data, "viridis", true
                ).then(drawImage);
            }
        }
        progress.hidden = true;
    }


    onClick(event) {
        if (this.selectedObject) {
            this.selectedObject.material.color.set('#ffffff');
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
            //const res = getClosestOpaque(intersects);
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

export {SpriteView}