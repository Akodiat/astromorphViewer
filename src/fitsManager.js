import {Lut} from "./lut.js";

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
            progress.value = i;
            const r = shuffledResult[i];

            if (r.filepath === undefined) {
                console.log(`Data not found: ${r}`);
                continue;
            }
            const fileName = r.filepath.split("/").slice(-1)[0];
            const data = this.imageData.get(fileName);

            // Get color data
            const colorData = await this.colorFromData(data, colorScheme, true);

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
        }
        progress.hidden = true;
    }
}

export {FitsManager}