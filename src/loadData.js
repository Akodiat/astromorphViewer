/**
 * Parse CSV with header, if you need to do anything fancier,
 * just use PapaParse instead (https://www.papaparse.com/)
 * @param {string} csvStr String representing the CSV content
 * @param {string} sep Separator (defaults to comma)
 * @returns
 */
function parseCSV(csvStr, sep=",", textHeaders=["object", "filepath"]) {
    // Split on newlines
    let lines = csvStr.split("\n");

    // Separate header from following lines
    const header = lines[0].split(sep);
    lines = lines.slice(1);

    return lines.map(line => {
        const values = line.split(sep);
        const e = {emb_dim: []};
        header.forEach((key, i) => {
            if (textHeaders.includes(key)) {
                e[key] = values[i];
            } else if (key.includes("emb_dim")) {
                const dim = parseFloat(key.split("emb_dim_")[1]);
                e.emb_dim[dim] = parseFloat(values[i]);
            } else {
                e[key] = parseFloat(values[i]);
            }
        });
        return e;
    });
}

async function loadCSVFile(file) {
    const text = await file.text()
    return parseCSV(text, ";");
}

export {loadCSVFile};