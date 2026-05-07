declare module "adm-zip" {
  export interface ZipEntry {
    entryName: string;
  }

  export default class AdmZip {
    constructor(input?: Buffer | string | Uint8Array);
    extractAllTo(targetPath: string, overwrite: boolean): void;
    getEntries(): ZipEntry[];
  }
}
