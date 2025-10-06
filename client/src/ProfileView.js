import React, { useState, useEffect } from 'react';
import './ProfileEdit.css';

const ProfileView = ({ username, currentUser, onClose, onBlock, onUnblock, isBlocked, authManager }) => {
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
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockToggle = () => {
    if (isBlocked) {
      onUnblock(username);
    } else {
      onBlock(username);
    }
  };

  if (loading) {
    return (
      <div className="profile-view-overlay" onClick={onClose}>
        <div className="profile-view-modal" onClick={(e) => e.stopPropagation()}>
          <div className="profile-loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  const Avatar = () => {
    if (profile?.avatar) {
      return (
        <img 
          src={profile.avatar} 
          alt={username}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );
    }
    return <span style={{ fontSize: '60px', fontWeight: 600 }}>{username[0].toUpperCase()}</span>;
  };

  return (
    <div className="profile-view-overlay" onClick={onClose}>
      <div className="profile-view-modal" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <div className="profile-view-content">
          <div className="profile-avatar-large">
            <Avatar />
          </div>

          <h2 className="profile-username">{profile?.displayName || username}</h2>
          <p className="profile-handle">@{username}</p>

          {profile?.status && (
            <div className="profile-info-section">
              <div className="profile-info-item">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>{profile.status}</span>
              </div>
            </div>
          )}

          {profile?.bio && (
            <div className="profile-info-section">
              <h3>О себе</h3>
              <p>{profile.bio}</p>
            </div>
          )}

          {profile?.birthdate && (
            <div className="profile-info-section">
              <div className="profile-info-item">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                </svg>
                <span>Дата рождения: {new Date(profile.birthdate).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          {currentUser !== username && (
            <div className="profile-actions">
              <button 
                className={`profile-action-btn ${isBlocked ? 'unblock' : 'block'}`}
                onClick={handleBlockToggle}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V15A4,4 0 0,0 11,11H13A2,2 0 0,1 15,13V15.17C14.07,15.71 13,16 12,16A6,6 0 0,1 6,12A6,6 0 0,1 12,6Z"/>
                </svg>
                {isBlocked ? 'Разблокировать' : 'Заблокировать'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileView;