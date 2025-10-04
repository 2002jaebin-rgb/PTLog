import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function ReservationsPage() {
  const [sessions, setSessions] = useState([]);
  const [reservations, setReservations] = useState([]);
  const trainer_id = supabase.auth.user().id;  // 트레이너 ID

  useEffect(() => {
    fetchSessions();
    fetchReservations();
  }, []);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('trainer_id', trainer_id)
      .order('date', { ascending: true });
    if (error) console.log(error);
    setSessions(data);
  };

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'pending')
      .eq('trainer_id', trainer_id);  // 트레이너의 예약만 가져오기
    if (error) console.log(error);
    setReservations(data);
  };

  const acceptReservation = async (reservation_id, session_id) => {
    await supabase
      .from('reservations')
      .update({ status: 'approved' })
      .eq('reservation_id', reservation_id);

    await supabase
      .from('sessions')
      .update({ status: 'booked' })
      .eq('session_id', session_id);

    fetchReservations();  // 예약 목록 갱신
  };

  const rejectReservation = async (reservation_id) => {
    await supabase
      .from('reservations')
      .update({ status: 'rejected' })
      .eq('reservation_id', reservation_id);

    fetchReservations();  // 예약 목록 갱신
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white">예약 관리</h1>

      <div className="space-y-3">
        {sessions.map((session) => (
          <Card key={session.session_id} className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-white">{session.date} {session.start_time} - {session.end_time}</p>
            </div>
            <div>
              {reservations.filter(res => res.session_id === session.session_id).map((reservation) => (
                <div key={reservation.reservation_id} className="my-2">
                  <p>예약자: {reservation.member_id}</p>
                  <Button onClick={() => acceptReservation(reservation.reservation_id, session.session_id)}>수락</Button>
                  <Button variant="secondary" onClick={() => rejectReservation(reservation.reservation_id)}>거절</Button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
