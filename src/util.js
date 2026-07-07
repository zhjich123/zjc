export async function deepFileList(fetchFileList, rootDir, depth) {
  const fileList = [];
  var currentDepth = 1;
  async function deepList(list, currentDepth) {
    for (const file of list) {
      if (file.isdir == 1) {
        if (depth && currentDepth >= depth) {
          continue;
        }
        await deepList(await fetchFileList(file.path), currentDepth + 1);
      } else {
        fileList.push(file);
      }
    }
  }
  await deepList(await fetchFileList(rootDir), currentDepth);
  return fileList;
}
