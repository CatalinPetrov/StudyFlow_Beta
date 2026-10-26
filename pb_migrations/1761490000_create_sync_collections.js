migrate((db) => {
  const dao = new Dao(db)
  const names = ['sf_tasks','sf_schedule','sf_exams','sf_events','sf_library_items','sf_library_folders','sf_decks','sf_cards','sf_focus_sessions','sf_pdf_notes','sf_meta']
  const users = dao.findCollectionByNameOrId('_pb_users_auth_')
  for (const name of names) {
    try { dao.findCollectionByNameOrId(name); continue } catch {}
    const collection = new Collection({
      type: 'base',
      name: name,
      schema: [
        new SchemaField({
          name: 'user',
          type: 'relation',
          required: true,
          options: { collectionId: users.id, maxSelect: 1, cascadeDelete: false }
        })
      ],
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    })
    dao.saveCollection(collection)
  }
}, (db) => {
  const dao = new Dao(db)
  const names = ['sf_tasks','sf_schedule','sf_exams','sf_events','sf_library_items','sf_library_folders','sf_decks','sf_cards','sf_focus_sessions','sf_pdf_notes','sf_meta']
  for (const name of names) {
    try { const col = dao.findCollectionByNameOrId(name); dao.deleteCollection(col) } catch {}
  }
})
