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
            alert(`Missing fits file: ${fileName}`);
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

}

export {FitsManager}