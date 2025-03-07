import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Execute both queries in parallel for better performance
    const [notificationsResponse, activityResponse] = await Promise.all([
      // Fetch notifications
      supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4),
        
      // Fetch recent activity
      supabase
        .from('activity_log')
        .select(`
          id,
          description,
          created_at,
          user_id,
          users:user_id(name)
        `)
        .order('created_at', { ascending: false })
        .limit(4)
    ]);
    
    const { data: recentNotifications } = notificationsResponse;
    const { data: recentActivityData } = activityResponse;
    
    // Process notifications
    const notifications = recentNotifications ? recentNotifications.map(notification => {
      const createdAt = new Date(notification.created_at);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
      let timeAgo;
      
      if (diffInMinutes < 60) {
        timeAgo = `${diffInMinutes} min`;
      } else if (diffInMinutes < 1440) {
        timeAgo = `${Math.floor(diffInMinutes / 60)} hora${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''}`;
      } else {
        timeAgo = `${Math.floor(diffInMinutes / 1440)} día${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''}`;
      }
      
      return {
        id: notification.id,
        text: notification.description,
        time: timeAgo,
        isNew: diffInMinutes < 60 // New if less than an hour old
      };
    }) : [];
    
    // Process recent activity
    const recentActivity = recentActivityData ? recentActivityData.map(activity => {
      const createdAt = new Date(activity.created_at);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
      let timeAgo;
      
      if (diffInMinutes < 60) {
        timeAgo = `${diffInMinutes} min`;
      } else if (diffInMinutes < 1440) {
        timeAgo = `${Math.floor(diffInMinutes / 60)} hora${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''}`;
      } else {
        timeAgo = `${Math.floor(diffInMinutes / 1440)} día${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''}`;
      }
      
      return {
        id: activity.id,
        text: activity.description,
        user: activity.users && typeof activity.users === 'object' 
          ? (activity.users as any).name || 'Usuario'
          : 'Usuario',
        time: timeAgo
      };
    }) : [];
    
    return NextResponse.json({ 
      notifications,
      recentActivity
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360' // Cache for 3 minutes, stale for 6
      }
    });
    
  } catch (error) {
    console.error('Error fetching activity data:', error);
    return NextResponse.json({ error: 'Error loading activity data' }, { status: 500 });
  }
} 