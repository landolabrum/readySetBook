// Title.tsx

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import environment from '~/src/core/environment';
import capitalize, { capitalizeAll } from '@webstack/helpers/Capitalize';
import useDarkMode from "@webstack/hooks/useDarkMode";

const Title: React.FC = () => {
  const router = useRouter();
  const merchantName = capitalizeAll(String(environment.merchant.name).replaceAll('-',' '));
  const path = capitalize(router.pathname.replace('/',''));
  const splitty = router.asPath?.split('/');
  const cleanTitle = (text: string)=>{
    if(text?.length < 1)return '';
    let context = '';
    context = text?.split('=')[Object(text?.split('=')).length - 1];


    // context = text.replaceAll('-', ' ').replaceAll('?', ' ')
    return capitalize(context);
  }
  const dialog =  `${merchantName}${
    splitty?.[1] && ` | ${cleanTitle(splitty[1])} ${cleanTitle(splitty[splitty.length - 1])}`
  }`;

  return (
    <Head>
      <title>{dialog}</title>
      {useDarkMode() ? (
        // servers/Deepturn/public/merchant/nirv1/favicon-lite.ico
        <link rel="shortcut icon" href={`/merchant/${environment.merchant.mid}/favicon-lite.ico`} />
      ) : <link rel="shortcut icon" href={`/merchant/${environment.merchant.mid}/favicon-dark.ico`} />}
    </Head>
  );
};

export default Title;
