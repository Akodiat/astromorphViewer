import {UMAP} from "../lib/umap.js";
import {aleaPRNG} from "../lib/aleaPRNG-1.1.min.js";
import {loadCSVFile} from "./loadData.js";
import {FitsManager} from "./fitsManager.js";
import {SpriteView} from "./sprites.js";

init();




function init() {
    const fitsInput = document.getElementById("fitsInput");
    const csvInput = document.getElementById("csvInput");
    const seedInput = document.getElementById("seed");
    const spriteCanvas = document.getElementById("spriteCanvas");

    const viewOptions = document.getElementById("viewOptions");
    const inputData = document.getElementById("inputData");

    if (seedInput.value == "") {
        seedInput.value = Math.round(Math.random() * 1000);
    }

    const fitsManager = new FitsManager();

    let spriteView;
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
        const results = await handleCSVData(csvInput.files[0], seedInput.value);
        spriteView = new SpriteView(spriteCanvas, results, fitsManager);
        if (fitsLoaded) {
            spriteView.spriteImagesFromFits();
            viewOptions.hidden = false;
            inputData.open = false;
        }
        csvLoaded = true;
    });
}

async function handleCSVData(file, seed) {
    const progress = document.getElementById("umapProgress");
    progress.hidden = false;

    const results = await loadCSVFile(file);
    console.log(results);

    const data = results.map(row => row.emb_dim);

    const prng = aleaPRNG(seed);
    const umap = new UMAP({
        random: prng,
        nComponents: 2
    });

    const nEpochs = umap.initializeFit(data);
    progress.max = nEpochs;
    const embedding = await umap.fitAsync(data, epochNumber => {
        // check progress and give user feedback, or return `false` to stop
        progress.value = epochNumber
    });
    progress.hidden = true;

    for (let i=0; i<results.length; i++) {
        results[i].umap_x = embedding[i][0];
        results[i].umap_y = embedding[i][1];
        results[i].umap_z = embedding[i][2];
    }

    document.getElementById("selectionInfo").hidden = false;

    return results;
}