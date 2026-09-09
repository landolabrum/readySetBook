import type { NextComponentType, NextPageContext } from "next";
import { useEffect, useState } from "react";
import styles from "./User.scss";
import UserMethods from "../views/UserMethods/controller/UserMethods";
import { useClearance, useUser } from "~/src/core/authentication/hooks/useUser";
// import UserModify from "../views/UserModify/UserModify";
import UiSettingsLayout from "@webstack/layouts/UiSettingsLayout/controller/UiSettingsLayout";
import UserPayments from "../views/UserPayments/controller/UserPayments";
import UserDocs from "../views/UserDocs/controller/UserDocs";
import UserProfile from "../views/UserProfile/UserProfile";
import UserSocial from "../views/UserSocial/UserSocial";

interface Props { }

const User: NextComponentType<NextPageContext, {}, Props> = ({ }: Props) => {
  const user = useUser();
  const level = useClearance();
  const [current, setCurrent] = useState('profile');
  const [views, setViews] = useState({
    profile: <UserProfile user={user} />,
    billing: <UserMethods open="opened" />,
    social: <UserSocial />,
    "email notification": "email notification",
    "privacy & security": "privacy & security",
  });

  useEffect(() => {
    if (level && level > 9) {
      setViews((prevViews) => ({
        ...prevViews,
        documents: <UserDocs user={user} previewPdf={false} />,
        payments: <UserPayments user={user} />,
      }));
    }
  }, [level]);

  return (
    <>
      <style jsx>{styles}</style>
      <UiSettingsLayout
        viewName="profile"
        title={current}
        customMenu={current !== "profile"}
        setViewCallback={(v) => setCurrent(v ?? "profile")}
        views={views}
      />
    </>
  );
};

export default User;
