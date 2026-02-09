import React, { useState } from 'react';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';
import { useAuthStore } from '../store/authStore';
import PlayerAvatar from '../components/game/PlayerAvatar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const Profile: React.FC = () => {
  const { user, uploadAvatar, selectDefaultAvatar, linkFacebook } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const logoSrc = "/assets/logo.png";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadAvatar(file);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <img src={logoSrc} alt="ReemTeam logo" className="w-10 h-10 object-contain" />
        <div>
          <h1 className="text-3xl font-bold text-white">Profile</h1>
          <p className="text-white/60 text-sm">Tune your identity and connections.</p>
        </div>
      </div>
      <div className="bg-black/60 border border-white/10 rounded-2xl p-6 backdrop-blur">
        <h2 className="text-xl font-semibold mb-4 text-white">Avatar Management</h2>
        <div className="flex items-center gap-6 mb-6">
          <PlayerAvatar player={{ name: user?.username || '', avatarUrl: user?.avatarUrl }} size="lg" />
          <div>
            <h3 className="font-medium text-white">{user?.username}</h3>
            <p className="text-sm text-white/60">Update your avatar below</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80" htmlFor="avatar-upload">
              Upload Custom Avatar
            </label>
            <div className="flex gap-4">
              <Input
                id="avatar-upload"
                type="file"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!file}>
                Upload
              </Button>
            </div>
            <p className="text-xs text-white/50 mt-2">
              PNG, JPG, or GIF. Max size 2MB.
            </p>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-lg font-medium mb-3 text-white">Select a Default Avatar</h3>
            <div className="flex gap-4">
                          {['/avatars/avatar1.png', '/avatars/avatar2.png', '/avatars/avatar3.png', '/avatars/avatar4.png'].map((avatar) => (
                            <img
                              key={avatar}
                              src={avatar}
                              alt="Default Avatar"
                              className="w-16 h-16 rounded-full cursor-pointer border-2 border-white/10 hover:border-yellow-400"
                              onClick={() => selectDefaultAvatar(avatar)}
                            />
                          ))}
                        </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-lg font-medium mb-3 text-white">Social Media Accounts</h3>
            <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-white">Facebook</h4>
                            <p className="text-sm text-white/60">Not connected</p>
                          </div>
                          <FacebookLogin
                                          appId="YOUR_FACEBOOK_APP_ID" // TODO: Replace with your App ID
                                          autoLoad={false}
                                          fields="name,email,picture"
                                          callback={(response: any) => linkFacebook(response.accessToken)}
                                          render={(renderProps: any) => (
                                            <Button variant="secondary" onClick={renderProps.onClick}>
                                              Link Account
                                            </Button>
                                          )}
                                        />
                        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
