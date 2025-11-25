
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
                console.log(item.datum.filepath);
                const fileName = item.datum.filepath.split("/").slice(-1)[0];
                fitsManager.drawImage(fileName);

                document.getElementById("textData").innerHTML = `
                <table>
                    <tr><td>cluster</td><td>${item.datum['cluster']}</td></tr>
                    <tr><td>object</td><td>${item.datum['object']}</td></tr>
                    <tr><td>right ascension</td><td>${item.datum['right ascension']}</td></tr>
                    <tr><td>declination</td><td>${item.datum['declination']}</td></tr>
                    <tr><td>rest freq</td><td>${item.datum['rest freq']}</td></tr>
                    <tr><td>filename</td><td>${fileName}</td></tr>
                </table>
                `
            }
        });
    });
}

export {scatterPlot}