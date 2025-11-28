import {Lut} from "./lut.js";
import {displayImageAndData} from "./utils.js";

class FitsData {
    constructor(file) {
        this.file = file;
    }

    readFile() {
        return new Promise(resolve => {
            new astro.FITS(this.file, result => {
                const hdu = result.hdus[0];

                // Get dimensions
                const width = hdu.data.width;
                const height = hdu.data.height;

                this.width = width;
                this.height = height;

                hdu.data.getFrame(0, frame => {
                    this.values = frame;

                    this.minV = Infinity;
                    this.maxV = -Infinity;

                    for (const v of frame) {
                        this.minV = Math.min(this.minV, v);
                        this.maxV = Math.max(this.maxV, v);
                    }
                    resolve();
                });
            });
        });
    }
}

class FitsManager {
    constructor() {
        this.imageData = new Map();
        this.currentDrawers = new Set();
    }

    readFiles(files) {
        for (const file of files) {
            this.imageData.set(file.name, new FitsData(file));
        }
    }

    async colorFromData(data, colorScheme="viridis", transparent=false) {
        if (!data.values) {
            // Only read fits files when we need to,
            // but keep the results in memory for next time
            await data.readFile();
        }

        // Assign colors to values

        const lut = new Lut(colorScheme);
        lut.minV = data.minV;
        lut.maxV = data.maxV;

        const colorData = new Uint8ClampedArray(data.width * data.height * 4); // RGBA
        for (let i = 0; i < data.values.length; i++) {
            const color = lut.getColor(data.values[i]);
            const j = i * 4;
            colorData[j] = color.r * 255;     // R
            colorData[j + 1] = color.g * 255; // G
            colorData[j + 2] = color.b * 255; // B
            colorData[j + 3] = (transparent ? // A
                255 * (data.values[i]/(data.maxV - data.minV)) :
                255
            );
        }
        return colorData;
    }

    async drawImage(fileName, colorScheme="viridis") {
        const data = this.imageData.get(fileName);

        if (data === undefined) {
            console.warn(`Missing fits file: ${fileName}`);
            return;
        }

        // Get color data
        const colorData = await this.colorFromData(data, colorScheme);

        // Draw image on canvas

        const canvas = document.getElementById("imageCanvas");
        canvas.width = data.width;
        canvas.height = data.height;

        const ctx = canvas.getContext('2d');
        const imgData = new ImageData(
            colorData, data.width, data.height
        );

        ctx.putImageData(imgData, 0, 0);
    }

    async drawFullMap(umapResults, scalingFactor=100, colorScheme="viridis") {
        const drawStartTime = new Date();
        this.currentDrawers.add(drawStartTime);
        const progress = document.getElementById("mapProgress");
        progress.max = umapResults.length;
        progress.hidden = false;

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

        const width = (xmax - xmin) * scalingFactor;
        const height = (ymax - ymin) * scalingFactor;

        const canvas = document.getElementById("mapCanvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        const shuffledResult = umapResults.map(
            value => ({value, sort: Math.random()})
            ).sort((a, b) => a.sort - b.sort
            ).map(({ value }) => value);

        for (let i=0; i<shuffledResult.length; i++) {

            // Check if newer drawing runs have started
            // after this one. If so, abort.
            if (this.currentDrawers.size > 1) {
                let deprecated;
                this.currentDrawers.forEach(t=>{
                    deprecated = t > drawStartTime
                });
                if (deprecated) {
                    break;
                }
            }
            progress.value = i;
            const r = shuffledResult[i];

            const fileName = r.filepath.split("/").slice(-1)[0];
            const data = this.imageData.get(fileName);

            if (data === undefined) {
                console.warn(`Missing fits file: ${fileName}`);
                continue;
            }

            const draw = colorData => {
                const tmpCanvas = document.createElement("canvas");
                tmpCanvas.width = data.width;
                tmpCanvas.height = data.height
                var ctx2 = tmpCanvas.getContext("2d");

                const imgData = new ImageData(
                    colorData, data.width, data.height
                );

                ctx2.putImageData(
                    imgData, 0, 0
                );

                // draw the temporary gradient canvas on the visible canvas
                ctx.drawImage(
                    tmpCanvas,
                    (r.umap_x - xmin) * scalingFactor,
                    height - ((r.umap_y - ymin) * scalingFactor)
                );
            };

            // Get color data, then draw. Do at most 10 parallel fits loads,
            // to avoid locking the browser
            if (i % 10 === 0) {
                // Wait for data to load, then draw
                const colorData = await this.colorFromData(
                    data, colorScheme, true
                );
                draw(colorData);
            } else {
                // Draw when data has loaded (asynchronously)
                this.colorFromData(
                    data, colorScheme, true
                ).then(colorData => draw(colorData));
            }
        }
        progress.hidden = true;
        this.currentDrawers.delete(drawStartTime);

        const cutoff = (xmax - xmin) / 100;
        canvas.onclick = event => {
            //const rect = canvas.getBoundingClientRect();
            const xScale =  canvas.width / canvas.clientWidth;
            const yScale =  canvas.height / canvas.clientHeight;
            const point = {
                x: event.offsetX * xScale,//event.clientX - rect.left,
                y: event.offsetY * yScale//event.clientY - rect.top
            };

            console.log(`canvas_x: ${point.x}, canvas_y: ${point.y}`);

            const x = (point.x / scalingFactor) + xmin;
            const y = ((height - point.y) / scalingFactor) + ymin

            console.log(`x: ${x}, y: ${y}`);

            // Find closest datapoint (within cutoff)
            let minDistSq = cutoff;
            let closest;
            for (const r of umapResults) {
                const distSq = (x - r.umap_x)**2 + (y - r.umap_y)**2;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closest = r;
                }
            }

            if (closest !== undefined) {
                displayImageAndData(closest, this);
            }
        };
    }
}

export {FitsManager}