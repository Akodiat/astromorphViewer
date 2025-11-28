
import {displayImageAndData} from "./utils.js";

function scatterPlot(embeddings, fitsManager) {
    var spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
        description: 'A simple bar chart with embedded data.',
        data: {
            values: embeddings
        },
        params: [{
            name: "grid",
            select: "interval",
            bind: "scales"
        }],
        mark: 'point',
        encoding: {
          x: {field: 'umap_x', type: 'quantitative'},
          y: {field: 'umap_y', type: 'quantitative'},
          color: {field: 'cluster', type: 'nominal'},
          //tooltip: [{field: "cluster"}, {field: "filepath"}],
        },
    };
    vegaEmbed("#vis", spec).then(result => {
        result.view.addEventListener("click", (event, item) => {
            if (item && item.datum && item.datum.filepath) {
                displayImageAndData(item.datum, fitsManager);
            }
        });
    });
}

export {scatterPlot}