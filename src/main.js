import {UMAP} from "../lib/umap.js";
import {aleaPRNG} from "../lib/aleaPRNG-1.1.min.js";
import {loadCSVFile} from "./loadData.js";
import {scatterPlot} from "./plot.js";
import {FitsManager} from "./fitsManager.js";
import { SpriteView } from "./sprites.js";

init();

let csvLoaded = false;
let fitsLoaded = false;

function init() {
    const fitsInput = document.getElementById("fitsInput");
    const csvInput = document.getElementById("csvInput");
    const seedInput = document.getElementById("seed");

    if (seedInput.value == "") {
        seedInput.value = Math.round(Math.random() * 1000);
    }

    const fitsManager = new FitsManager();

    fitsInput.addEventListener("change", () => {
        fitsManager.readFiles(fitsInput.files);
        fitsLoaded = true;
        // Display map container when all data is loaded
        document.getElementById("mapContainer").hidden = !csvLoaded;
    });

    csvInput.addEventListener("change", () =>
        handleCSVData(csvInput.files[0], fitsManager, seedInput.value).then(() => {
            csvLoaded = true;
            // Display map container when all data is loaded
            document.getElementById("mapContainer").hidden = !fitsLoaded;
        })
    );
}

async function handleCSVData(file, fitsManager, seed) {
    const progress = document.getElementById("umapProgress");
    progress.hidden = false;

    const results = await loadCSVFile(file);
    console.log(results);

    const data = results.map(row => row.emb_dim);

    const prng = aleaPRNG(seed);
    const umap = new UMAP({random: prng});

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
    }

    document.getElementById("interactiveUMAPContainer").hidden = false;

    scatterPlot(results, fitsManager);

    const mapButton = document.getElementById("mapButton");
    const scalingFactorInput = document.getElementById("mapScalingFactor");
    mapButton.onclick = () => {
        mapButton.hidden = true;
        const scalingFactor = parseFloat(scalingFactorInput.value);
        //fitsManager.drawFullMap(results, scalingFactor);

        const spriteCanvas = document.getElementById("spriteCanvas");
        const spriteView = new SpriteView(spriteCanvas, results, fitsManager);
    }
}