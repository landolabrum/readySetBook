import React from 'react';
import styles from './UserProfile.scss';
import IAuthenticatedUser from "~/src/models/ICustomer";
import AdaptTableCell from '@webstack/components/AdapTable/components/AdaptTableContent/components/AdaptTableCell/AdaptTableCell';
import UserModify from '../UserModify/UserModify';

interface IUserProfile {
  user?: IAuthenticatedUser;
}

const UserProfile: React.FC<IUserProfile> = ({ user }) => {
  const handleUserModified = (updated: IAuthenticatedUser) => {
    // Parent or global state can be refreshed here if needed
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className='user-profile'>
        <div className='user-profile__body'>
          <div className='user-profile__card'>
            <AdaptTableCell cell='member' data={user} />
          </div>
        </div>
        <div className='user-profile__card'>
          <UserModify user={user} modifyUser={handleUserModified} />
        </div>
      </div>
    </>
  );
};

export default UserProfile;
