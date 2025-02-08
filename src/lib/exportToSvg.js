import { toSvg } from "html-to-image";

/**
 * Exports a React component as an SVG
 * @param {HTMLElement} node - The DOM node to convert (usually a ref.current)
 * @param {string} fileName - The name of the file to download (without extension)
 * @returns {Promise<void>}
 */
export const exportToSvg = async (node, fileName = "export") => {
  try {
    const svgString = await toSvg(node, {
      quality: 1,
      backgroundColor: "#ffffff",
    });

    // Create a download link
    const link = document.createElement("a");
    link.download = `${fileName}.svg`;
    link.href = svgString;
    link.click();
  } catch (error) {
    console.error("Error exporting to SVG:", error);
    throw error;
  }
};
