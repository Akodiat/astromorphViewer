function displayImageAndData(datapoint, fitsManager) {
    console.log(datapoint.filepath);
    const fileName = datapoint.filepath.split("/").slice(-1)[0];
    fitsManager.drawImage(fileName);

    document.getElementById("textData").innerHTML = `
        <tr><td>cluster</td><td>${datapoint['cluster']}</td></tr>
        <tr><td>object</td><td>${datapoint['object']}</td></tr>
        <tr><td>right ascension</td><td>${datapoint['right ascension']}</td></tr>
        <tr><td>declination</td><td>${datapoint['declination']}</td></tr>
        <tr><td>rest freq</td><td>${datapoint['rest freq']}</td></tr>
        <tr><td>UMAP x</td><td>${datapoint['umap_x']}</td></tr>
        <tr><td>UMAP y</td><td>${datapoint['umap_y']}</td></tr>
        <tr><td>filename</td><td>${fileName}</td></tr>
    `
}

// https://discourse.threejs.org/t/how-to-ignore-the-transparent-part-of-sprite-by-ray-pickup/7773/3
function getClosestOpaque(intersectObjects) {
    // For every intersected object returned by the raycaster
    for (const intersect of intersectObjects) {
        const {object} = intersect;
        // If the material has a texture
        if (object.material.map) {
            // Get the image from the intersect object mesh
            const {image} = object.material.map;
            // 2D ratio of where the mouse is on the image
            const {uv: {x: UX, y: UY}} = intersect;
            // The actual w, h of the image
            const {width: OW, height: OH} = image;
            // Get the image data
            const imageData = getImageData(image);
            // the X & Y of the image
            const x = Math.round(UX * OW);
            const y = OH - Math.round(UY * OH); // reverse because threejs
            // the index of image data y is every row of pixels, x is on a row of pixels
            const I = (x + y * OW) * 4;
            // the fourth (3) of every 4 numbers is the alpha value
            const A = imageData.data[I + 3];
            // if A is 0 then it's transparent
            if (A === 0) {
                continue;
            }
        }
        return intersect;
    }
}

function getImageData(image) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let {width: w, height: h} = image;
    canvas.width = w;
    canvas.height = h;
    context.drawImage(image, 0, 0, w, h);
    const imageData = context.getImageData(0, 0, w, h);
    return imageData;
}

export {displayImageAndData, getClosestOpaque};