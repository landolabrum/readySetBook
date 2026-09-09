import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CollectStripeForm from "../views/Payment";
import styles from "./Collect.scss";
import { useEffect } from "react";
import useSetupIntentSecret from "~/src/core/services/MemberService/hooks/useSetupIntentSecret";
import IAuthenticatedUser from "~/src/models/ICustomer";
interface IStripePaymentForm {
    user?: IAuthenticatedUser;
    success_url?: string;
    onSuccess:(e:any)=>void;
}
const stripeKey:string = String(process.env.NEXT_PUBLIC_STRIPE_PUBLISH_KEY?.trim())

const stripePromise = loadStripe(stripeKey);


const Collect = ({ user, onSuccess, success_url }:IStripePaymentForm) => {
  const clientSecret = useSetupIntentSecret(user);

    const appearance = {
        theme: 'night' as 'stripe',
        variables: {
          colorPrimary: 'var(--primary-30)',
          colorBackground: 'var(--dark)',
          colorText: 'var(--gray-10)',
        },
      };
      
      useEffect(() => {}, [clientSecret]);
    if(clientSecret)return (<>
      <style jsx>{styles}</style>
    <div className='guest-checkout'>
      <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
        <CollectStripeForm 
          onSuccess={onSuccess}
          success_url="/success"
        />

      </Elements>
      </div>
      </>
    );
    return <>... load</>
  };
export default Collect;