import { Injectable, OnModuleInit } from "@nestjs/common";
import { readFile } from "fs/promises";
import { join } from "path";
import type { DocumentLanguage } from "./dto/document-type.enum";

export type I18nBundle = Record<string, string>;

export interface I18nBundles {
  vi: I18nBundle;
  en: I18nBundle;
}

@Injectable()
export class I18nService implements OnModuleInit {
  private bundles: I18nBundles = { vi: {}, en: {} };

  async onModuleInit() {
    await this.loadBundles();
  }

  async loadBundles() {
    const base = join(__dirname, "i18n");
    const [vi, en] = await Promise.all([
      readFile(join(base, "vi.json"), "utf-8"),
      readFile(join(base, "en.json"), "utf-8")
    ]);
    this.bundles = {
      vi: JSON.parse(vi) as I18nBundle,
      en: JSON.parse(en) as I18nBundle
    };
  }

  getBundles(): I18nBundles {
    return this.bundles;
  }

  /**
   * Returns the i18n string for a given key + target language.
   *
   * For `lang === "vi"` we return only the Vietnamese string.
   * For `lang === "vi-en"` we return a span-wrapped bilingual fragment that
   * the CSS can style (or the consumer can post-process).
   *
   * Falls back to the key itself if missing in both bundles.
   */
  get(lang: DocumentLanguage, key: string): string {
    const vi = this.bundles.vi[key];
    const en = this.bundles.en[key];

    if (lang === "vi-en") {
      if (vi && en) {
        return `<span class="lang-vi">${vi}</span><span class="lang-en">${en}</span>`;
      }
      return vi ?? en ?? key;
    }

    return vi ?? en ?? key;
  }

  /**
   * Raw lookup without bilingual formatting.
   */
  raw(lang: "vi" | "en", key: string): string | undefined {
    return this.bundles[lang]?.[key];
  }
}
