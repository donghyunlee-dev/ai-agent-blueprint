export function selectedFileForSourceResult(result, files) {
  return Number.isInteger(result.fileIndex) ? files[result.fileIndex] : undefined;
}
