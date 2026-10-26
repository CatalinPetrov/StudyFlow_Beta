import PocketBase from 'pocketbase'
const pb = new PocketBase('http://127.0.0.1:8090')

const names = ['sf_tasks','sf_schedule','sf_exams','sf_events','sf_library_items','sf_library_folders','sf_decks','sf_cards','sf_focus_sessions','sf_pdf_notes','sf_meta']

for (const name of names) {
  try {
    const existing = await pb.collections.getOne(name).catch(()=>null)
    if (existing) { console.log('exists', name); continue }
    console.log('need auth')
  } catch(e) {
    console.log('err', name, e.message)
  }
}
