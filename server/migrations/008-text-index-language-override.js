export const id = '008-text-index-language-override';
export const description = 'Rebuild the course and material text indexes so a language Mongo cannot stem is still saveable';

/**
 * A text index reads each document's `language` field to choose a stemmer, so
 * a course taught in Luganda could not be written at all. The index now looks
 * for `textLanguage`, which nothing sets — dropping the old one lets Mongoose
 * rebuild it with that override.
 */
export const up = async (db) => {
  for (const name of ['courses', 'resources']) {
    const collection = db.collection(name);
    const indexes = await collection.indexes().catch(() => []);
    const text = indexes.find((i) => Object.values(i.key ?? {}).includes('text'));
    if (text && text.language_override !== 'textLanguage') {
      await collection.dropIndex(text.name);
    }
  }
};
