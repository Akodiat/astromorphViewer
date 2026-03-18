import {UMAP} from "../lib/umap.js";
import {aleaPRNG} from "../lib/aleaPRNG-1.1.min.js";
import {loadCSVFile} from "./loadData.js";
import {FitsManager} from "./fitsManager.js";
import {SpriteView} from "./sprites.js";

init();

function init() {
    // Setup DOM element references
    const fitsInput = document.getElementById("fitsInput");
    const csvInput = document.getElementById("csvInput");
    const seedInput = document.getElementById("seed");
    const inputData = document.getElementById("inputData");

    const spriteCanvas = document.getElementById("spriteCanvas");
    const viewOptions = document.getElementById("viewOptions");
    const umapDimensions = () => parseInt(document.querySelector(
        'input[name="umapDimensions"]:checked'
    ).value);

    // Use random seed if none is provided
    if (seedInput.value == "") {
        seedInput.value = Math.round(Math.random() * 1000);
    }

    const fitsManager = new FitsManager();
    let spriteView;
    let data;

    // Flags to make sure all data is loaded before we draw any sprites
    let csvLoaded = false;
    let fitsLoaded = false;

    fitsInput.addEventListener("change", () => {
        fitsManager.readFiles(fitsInput.files);
        fitsLoaded = true;
        if (csvLoaded) {
            spriteView.spriteImagesFromFits();
            viewOptions.hidden = false;
            inputData.open = false;
        }
    });

    csvInput.addEventListener("change", async () => {
        data = await loadCSVFile(csvInput.files[0]);
        await calcUMAP(data, seedInput.value, umapDimensions());
        spriteView = new SpriteView(spriteCanvas, data, fitsManager, umapDimensions());
        if (fitsLoaded) {
            spriteView.spriteImagesFromFits();
            viewOptions.hidden = false;
            inputData.open = false;
        }
        csvLoaded = true;
    });

    seedInput.addEventListener("change", async () => {
        if (csvLoaded) {
            await calcUMAP(data, seedInput.value, umapDimensions());
            spriteView.updateUmapPositions(data);
        }
    });

    document.querySelectorAll('input[name="umapDimensions"]').forEach(el => {
        el.addEventListener("change", async ()=>{
            if (csvLoaded) {
                const nDim = umapDimensions();
                await calcUMAP(data, seedInput.value, nDim);
                spriteView.updateUmapPositions(data);
                spriteView.setDimensionality(nDim);
            }
        })
    });
}

/**
 * Calculate UMAP and append results to data
 * @param {Object[]} data
 * @param {number | string} seed Seed to random number generator
 * @returns
 */
async function calcUMAP(data, seed=undefined, nDim=3) {

    const progress = document.getElementById("umapProgress");
    progress.hidden = false;

    const embeddings = data.map(row => row.emb_dim);

    const prng = aleaPRNG(seed);
    const umap = new UMAP({
        random: prng,
        nComponents: nDim
    });

    const nEpochs = umap.initializeFit(embeddings);
    progress.max = nEpochs;
    const umapResult = await umap.fitAsync(embeddings, epochNumber => {
        progress.value = epochNumber;
    });
    progress.hidden = true;

    for (let i=0; i<data.length; i++) {
        data[i].umap_x = umapResult[i][0];
        data[i].umap_y = umapResult[i][1];
        data[i].umap_z = umapResult[i][2];
    }

    document.getElementById("selectionInfo").hidden = false;

    return data;
}