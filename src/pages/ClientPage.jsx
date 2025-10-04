const { data: requests } = await supabase
  .from('session_requests')
  .select('*')
  .eq('status', 'pending')

const handleAccept = async (id) => {
  await supabase.from('session_requests').update({ status: 'accepted' }).eq('id', id)
}
