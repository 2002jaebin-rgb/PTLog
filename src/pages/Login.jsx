const { data: { user } } = await supabase.auth.getUser()

// role 확인
const { data: trainer } = await supabase
  .from('trainers')
  .select('id')
  .eq('id', user.id)
  .single()

if (trainer) {
  navigate('/dashboard')
} else {
  navigate('/client')
}
