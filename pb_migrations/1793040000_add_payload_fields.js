migrate((db) => {
  const dao = new Dao(db)
  const names = ['sf_tasks','sf_schedule','sf_exams','sf_events','sf_library_items','sf_library_folders','sf_decks','sf_cards','sf_focus_sessions','sf_pdf_notes','sf_meta']
  for (const name of names) {
    const collection = dao.findCollectionByNameOrId(name)
    const existing = {}
    for (let i = 0; i < collection.schema.length; i++) {
      existing[collection.schema[i].name] = collection.schema[i]
    }
    if (!existing['payload']) {
      collection.schema.addField(new SchemaField({
        id: 'payloadjson01',
        name: 'payload',
        type: 'json',
        required: false,
        presentable: false,
        unique: false,
        options: { maxSize: 5000000 },
      }))
    } else if (existing['payload'].options.maxSize !== 5000000) {
      existing['payload'].options.maxSize = 5000000
    }
    if (name === 'sf_meta' && !existing['key']) {
      collection.schema.addField(new SchemaField({
        id: 'metakeytxt01',
        name: 'key',
        type: 'text',
        required: false,
        presentable: false,
        unique: false,
        options: { min: 0, max: 255, pattern: '' },
      }))
    } else if (name === 'sf_meta' && existing['key'] && existing['key'].options.max !== 255) {
      existing['key'].options.max = 255
    }
    dao.saveCollection(collection)
  }
}, (db) => {
  const dao = new Dao(db)
  const names = ['sf_tasks','sf_schedule','sf_exams','sf_events','sf_library_items','sf_library_folders','sf_decks','sf_cards','sf_focus_sessions','sf_pdf_notes','sf_meta']
  for (const name of names) {
    try {
      const collection = dao.findCollectionByNameOrId(name)
      collection.schema.removeField('payload')
      if (name === 'sf_meta') {
        try { collection.schema.removeField('key') } catch {}
      }
      dao.saveCollection(collection)
    } catch {}
  }
})
