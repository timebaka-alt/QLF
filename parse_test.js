const text = "KK-1398 Trở Về Những Năm 80 重回八零前夫他不香了";
let code = 'UNKNOWN';
const codeKeywordMatch = text.match(/(?:mã|code|id)[\s:]*([A-Za-z0-9\-_]+)/i);
if (codeKeywordMatch) {
  code = codeKeywordMatch[1];
} else {
  const fallbackMatch = text.match(/^([A-Za-z0-9\-_]+)/);
  if (fallbackMatch && fallbackMatch[1].length > 1) { 
     code = fallbackMatch[1];
  }
}
console.log("Code:", code);
