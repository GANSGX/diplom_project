import React, { useState, useEffect } from 'react';
import './ProfileView.css';

const ProfileView = ({ username, onClose, authManager }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      const response = await fetch(`${authManager.serverUrl}/profile/${username}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        setProfile({
          username,
          displayName: '',
          avatar: '',
          status: '',
          bio: '',
          birthdate: ''
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfile({
        username,
        displayName: '',
        avatar: '',
        status: '',
        bio: '',
        birthdate: ''
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="profile-overlay" onClick={onClose}>
        <div className="profile-modal" onClick={e => e.stopPropagation()}>
          <div className="profile-loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  const age = profile?.birthdate ? calculateAge(profile.birthdate) : null;

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal profile-view-modal" onClick={e => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <div className="profile-header">
          <div className="profile-avatar-large">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="Avatar" />
            ) : (
              <span>{(profile?.displayName || username)[0].toUpperCase()}</span>
            )}
          </div>
          <h2 className="profile-name">{profile?.displayName || username}</h2>
          <p className="profile-username">@{username}</p>
          {profile?.status && (
            <p className="profile-status">{profile.status}</p>
          )}
        </div>

        <div className="profile-content">
          {profile?.bio && (
            <div className="profile-section">
              <div className="profile-section-header">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                <span>О себе</span>
              </div>
              <p className="profile-bio">{profile.bio}</p>
            </div>
          )}

          <div className="profile-section">
            <div className="profile-section-header">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
              </svg>
              <span>Информация</span>
            </div>
            <div className="profile-info-list">
              <div className="profile-info-item">
                <span className="profile-info-label">Username</span>
                <span className="profile-info-value">@{username}</span>
              </div>
              {age && (
                <div className="profile-info-item">
                  <span className="profile-info-label">Возраст</span>
                  <span className="profile-info-value">{age} лет</span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-section">
            <div className="profile-section-header">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
              <span>Безопасность</span>
            </div>
            <p className="profile-security-note">
              Все сообщения защищены сквозным шифрованием
            </p>
          </div>
        </div>

        <div className="profile-actions">
          <button className="profile-action-btn">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <span>Написать сообщение</span>
          </button>
          <button className="profile-action-btn profile-action-btn-danger">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.59-13L12 10.59 8.41 7 7 8.41 10.59 12 7 15.59 8.41 17 12 13.41 15.59 17 17 15.59 13.41 12 17 8.41z"/>
            </svg>
            <span>Заблокировать</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;