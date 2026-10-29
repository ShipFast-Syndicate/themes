// Constant pre-paint script for system mode. It is a frozen pair with the CSP
// source below: any change to the text changes the hash, and tests compare the
// pair against a literal. The script touches no cookie or storage.
export const systemBootScript: string =
  '(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var t=d.getAttribute(m.matches?"data-theme-dark":"data-theme-light");if(t)d.setAttribute("data-theme",t)}a();if(m.addEventListener)m.addEventListener("change",a)})()';

// CSP script-src source for the exact bytes of systemBootScript: SHA-256, base64.
export const systemBootScriptCspSource: string =
  "'sha256-foCTvNoUB9XS/pGj3Y2eLtgy+7en967pvmsFOG63d2M='";
