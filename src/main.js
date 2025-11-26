import {Lut} from "./lut.js";
import {UMAP} from "../lib/umap.js";
import {loadCSVFile} from "./loadData.js";
import {scatterPlot} from "./plot.js";
import { FitsManager } from "./fitsManager.js";

init();

function init() {
    const fitsInput = document.getElementById("fitsInput");
    const csvInput = document.getElementById("csvInput");

    const fitsManager = new FitsManager();

    fitsInput.addEventListener("change", () => {
        fitsManager.readFiles(fitsInput.files);
    });

    csvInput.addEventListener("change", () =>
        handleCSVData(csvInput.files[0], fitsManager)
    );
}

async function handleCSVData(file, fitsManager) {
    const progress = document.getElementById("umapProgress");
    progress.hidden = false;

    const results = await loadCSVFile(file);
    console.log(results);

    const data = results.map(row => row.emb_dim);

    console.log("data");
    console.log(data);

    const umap = new UMAP();

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

    scatterPlot(results, fitsManager);

    console.log("embedding");
    console.log(embedding);

}