import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LearnedWritingStyle, Product } from "@/types";

interface ProductFileShape {
  products?: Record<string, Product>;
}

interface LearnedStylesFileShape {
  styles?: LearnedWritingStyle[];
}

function dataDir(): string {
  return process.env.JOTO_DATA_DIR ?? path.join(process.cwd(), "data", "joto");
}

function productsPath(): string {
  return path.join(dataDir(), "products.json");
}

function learnedStylesPath(): string {
  return path.join(dataDir(), "learned-styles.json");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

export async function readPersistedProducts(): Promise<Record<string, Product>> {
  const file = await readJsonFile<ProductFileShape>(productsPath(), {
    products: {},
  });
  return file.products ?? {};
}

export async function writePersistedProducts(
  products: Record<string, Product>
): Promise<Record<string, Product>> {
  await writeJsonFile(productsPath(), {
    updatedAt: new Date().toISOString(),
    products,
  });
  return products;
}

export async function upsertPersistedProduct(
  product: Product
): Promise<Record<string, Product>> {
  const products = await readPersistedProducts();
  const next = {
    ...products,
    [product.id]: product,
  };
  return writePersistedProducts(next);
}

export async function removePersistedProduct(
  id: string
): Promise<Record<string, Product>> {
  const products = await readPersistedProducts();
  const next = { ...products };
  delete next[id];
  return writePersistedProducts(next);
}

export async function readPersistedLearnedStyles(): Promise<
  LearnedWritingStyle[]
> {
  const file = await readJsonFile<LearnedStylesFileShape>(learnedStylesPath(), {
    styles: [],
  });
  return file.styles ?? [];
}

export async function writePersistedLearnedStyles(
  styles: LearnedWritingStyle[]
): Promise<LearnedWritingStyle[]> {
  await writeJsonFile(learnedStylesPath(), {
    updatedAt: new Date().toISOString(),
    styles,
  });
  return styles;
}

export async function upsertPersistedLearnedStyle(
  style: LearnedWritingStyle
): Promise<LearnedWritingStyle[]> {
  const styles = await readPersistedLearnedStyles();
  const without = styles.filter((item) => item.id !== style.id);
  return writePersistedLearnedStyles([style, ...without]);
}

export async function removePersistedLearnedStyle(
  id: string
): Promise<LearnedWritingStyle[]> {
  const styles = await readPersistedLearnedStyles();
  return writePersistedLearnedStyles(styles.filter((style) => style.id !== id));
}
