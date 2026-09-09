import { useEffect, useState } from "react";
import { useUser } from "~/src/core/authentication/hooks/useUser";
import { getService } from "@webstack/common";
import IMemberService from "~/src/core/services/MemberService/IMemberService";
import useUserAgent from "~/src/core/authentication/hooks/useUserAgent";
import styles from "./LoginView.scss";
import type { ILogin } from "../../../../controller/AuthTypes";
import environment from "~/src/core/environment";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import UiForm from "@webstack/components/UiForm/controller/UiForm";
import { findField, updateField } from "@webstack/components/UiForm/functions/formFieldFunctions";
import { useNotification } from "@webstack/components/Notification/Notification";


const LoginView: React.FC<ILogin> = ({ email, onSuccess }: ILogin) => {


  const onSubmit = (e: any) => {
    const request = {
      email: findField(e, 'email')?.value,
      metadata: {
        user: {
          password: findField(e, 'password')?.value,
        },
        merchant: environment.merchant
      }
    };
    setLoading(true);
    MemberService.logInUser(request).then((response) => {
      setLoading(false);
      const errorFields = response?.detail?.fields || response?.fields;
      if (errorFields) {
        const newFields = fields.map((field: any) => {
          const errorField = findField(errorFields, field.name)
          if (errorField) {
            return { ...field, ...errorField }
          }
          return field
        });
        setFields(newFields);
        // Surface a user-facing notification
        const label = "Login failed";
        const msg = (findField(errorFields, 'password')?.error
          || findField(errorFields, 'email')?.error
          || "Invalid email or password");
        setNotification({
          active: true,
          dismissable: true,
          list: [{ label, message: msg }]
        });
      } else {
        onSuccess?.(response);
      }

    })
      .catch((err: any) => {
        setLoading(false);
        // Handle FormFieldsException from ApiService (raised errors with field details)
        const errorFields = err?.detail?.fields || err?.fields;
        if (errorFields) {
          const newFields = fields.map((field: any) => {
            const errorField = findField(errorFields, field.name);
            if (errorField) return { ...field, ...errorField };
            return field;
          });
          setFields(newFields);
          const label = "Login failed";
          const msg = (findField(errorFields, 'password')?.error
            || findField(errorFields, 'email')?.error
            || "Invalid email or password");
          setNotification({
            active: true,
            dismissable: true,
            list: [{ label, message: msg }]
          });
        } else {
          // Network or unexpected failure
          const apiErr = err?.status ? err : { message: 'Login error', status: 500, detail: err, error: true };
          setNotification({ active: true, dismissable: true, apiError: apiErr });
        }
      });
  }

  const userResponse = useUser();
  const MemberService = getService<IMemberService>("IMemberService");
  const user_agent = useUserAgent();
  const [, setNotification] = useNotification();

  const [loading, setLoading] = useState<boolean>(false);
  let defaultCredentials = [
    { name: 'email', type: "email", traits:{width: "100%"}, label: 'email', placeholder: 'your email', value: email || '' },
    {
      name: 'password', traits: { width: "100%" }, label: 'password', type: 'password', placeholder: "* * * * * * *", onKeyDown: (e: any) => {
        if (e.key === 'Enter' && e.target.value && e.target.name == 'password')
          onSubmit(fields)
      }
    },
  ] as IFormField[];
  const [fields, setFields] = useState<IFormField[] | []>(defaultCredentials);
  const onChange = (e: any) => {
    const { name, value } = e.target
    setFields(fields.map(field => { if (field.name == name) field.value = value; return field }))

  }


  return (
    <>
      <style jsx>{styles}</style>
      <UiForm  fields={fields}  onChange={onChange} onSubmit={onSubmit} loading={loading} disabled={loading} submitText="login" />
    </>
  );
}

export default LoginView;
