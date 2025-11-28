function displayImageAndData(datapoint, fitsManager) {
    console.log(datapoint.filepath);
    const fileName = datapoint.filepath.split("/").slice(-1)[0];
    fitsManager.drawImage(fileName);

    document.getElementById("textData").innerHTML = `
    <table>
        <tr><td>cluster</td><td>${datapoint['cluster']}</td></tr>
        <tr><td>object</td><td>${datapoint['object']}</td></tr>
        <tr><td>right ascension</td><td>${datapoint['right ascension']}</td></tr>
        <tr><td>declination</td><td>${datapoint['declination']}</td></tr>
        <tr><td>rest freq</td><td>${datapoint['rest freq']}</td></tr>
        <tr><td>UMAP x</td><td>${datapoint['umap_x']}</td></tr>
        <tr><td>UMAP y</td><td>${datapoint['umap_y']}</td></tr>
        <tr><td>filename</td><td>${fileName}</td></tr>
    </table>
    `
}

export {displayImageAndData};