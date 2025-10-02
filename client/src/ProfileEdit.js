import React, { useState, useEffect } from 'react';
import './ProfileEdit.css';

const ProfileEdit = ({ username, onClose, authManager }) => {
  const [profile, setProfile] = useState({
    displayName: '',
    avatar: '',
    status: '',
    bio: '',
    birthdate: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch(`${authManager.serverUrl}/profile/${username}`);
      if (response.ok) {
        const data = await response.json();
        setProfile({
          displayName: data.displayName || '',
          avatar: data.avatar || '',
          status: data.status || '',
          bio: data.bio || '',
          birthdate: data.birthdate || ''
        });
        if (data.avatar) {
          setAvatarPreview(data.avatar);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Файл слишком большой. Максимум 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setProfile({ ...profile, avatar: base64 });
        setAvatarPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${authManager.serverUrl}/profile/${username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      if (response.ok) {
        console.log('Профиль обновлён');
        onClose();
      } else {
        alert('Не удалось сохранить профиль');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal profile-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="profile-edit-header">
          <button className="profile-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          <h2>Редактировать профиль</h2>
        </div>

        <div className="profile-edit-content">
          <div className="profile-edit-avatar-section">
            <label className="profile-avatar-upload">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <div className="profile-avatar-large">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" />
                ) : (
                  <span>{(profile.displayName || username)[0].toUpperCase()}</span>
                )}
                <div className="avatar-upload-overlay">
                  <svg viewBox="0 0 24 24" width="32" height="32">
                    <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <p>Изменить фото</p>
                </div>
              </div>
            </label>
          </div>

          <div className="profile-edit-form">
            <div className="form-group">
              <label>Имя</label>
              <input
                type="text"
                placeholder="Ваше имя"
                value={profile.displayName}
                onChange={e => setProfile({ ...profile, displayName: e.target.value })}
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label>Username (нельзя изменить)</label>
              <input
                type="text"
                value={username}
                disabled
                className="input-disabled"
              />
            </div>

            <div className="form-group">
              <label>Статус</label>
              <input
                type="text"
                placeholder="Hey there! I'm using SecureChat"
                value={profile.status}
                onChange={e => setProfile({ ...profile, status: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>О себе</label>
              <textarea
                placeholder="Расскажите о себе..."
                value={profile.bio}
                onChange={e => setProfile({ ...profile, bio: e.target.value })}
                maxLength={200}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Дата рождения</label>
              <input
                type="date"
                value={profile.birthdate}
                onChange={e => setProfile({ ...profile, birthdate: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="profile-edit-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;