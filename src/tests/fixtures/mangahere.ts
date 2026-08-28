export const BULK_PACKED_SCRIPT = String.raw`eval(function(p,a,c,k,e,d){return p;}('0=[\'//img.example/1.jpg\',\'//img.example/2.jpg\'];',62,1,'newImgs'.split('|'),0,{}))`;

export const PAGE_PACKED_SCRIPT = String.raw`eval(function(p,a,c,k,e,d){return p;}('0=\'//img.example/\';1=[\"003.jpg\"];',62,2,'pix|pvalue'.split('|'),0,{}))`;

export const KEY_PACKED_SCRIPT = String.raw`eval(function(p,a,c,k,e,d){return p;}('var 0=\'ab\'+\'cd\';',62,1,'key'.split('|'),0,{}))`;

export const MALFORMED_PACKED_SCRIPT =
  "eval(function(p,a,c,k,e,d){return p;}('payload',62,'broken'))";
