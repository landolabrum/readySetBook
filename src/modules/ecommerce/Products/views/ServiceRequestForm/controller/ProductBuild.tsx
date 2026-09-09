import React, { useCallback, useEffect, useState } from 'react';
import styles from './ProductBuild.scss';
import ProductBuildUsageView from '../views/ProductBuildUsageView/ProductBuildUsage';
import ProductBuildQualify from '../views/ProductBuildQualify/ProductBuildQualify';
import { defaultProductBuild } from '../data/productBuildDefaults';
import useProductBuildForm from '../functions/useProductBuildForm';
import { useLoader } from '@webstack/components/Loader/Loader';
import { findField } from '@webstack/components/UiForm/functions/formFieldFunctions';
import { useModal } from '@webstack/components/Containers/modal/contexts/modalContext';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import UiButtonGroup from '@webstack/components/UiForm/components/UiButtonGroup/controller/UiButtonGroup';
import ContactForm from '@shared/components/Contact/forms/ContactForm/ContactForm';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { useGuest } from '~/src/core/authentication/hooks/useGuest';
import { useUser } from '~/src/core/authentication/hooks/useUser';
import environment from '~/src/core/environment';
import keyStringConverter from '@webstack/helpers/keyStringConverter';
import UiBarGraph from '@webstack/components/Graphs/UiBarGraph/UiBarGraph';
import { capitalize, first } from 'lodash';
import useWindow from '@webstack/hooks/window/useWindow';
import UiMedia from '@webstack/components/UiMedia/controller/UiMedia';
const serverUrl = String(process.env.NEXT_PUBLIC_PRODUCTION_SERVER?.trim() || '');

const ProductBuild: React.FC = () => {
  // const { scrollTo, setScrollTo } = useScrollTo({ scrollToTop: true });
  // const view = String(query?.step)?.length?query?.step:'';
  const { openModal, closeModal, replaceModal, isModalOpen } = useModal();
  const [view, setView] = useState<undefined | string>();
  const [lastView, setLasView] = useState<undefined | string>();
  const [message, setMessage] = useState<any>();
  const { fields, setField, onSubmit, request, response, clearForm, fieldErrors } = useProductBuildForm();
  const [loading, setLoading] = useLoader();
  const user = useUser();
  const guest = useGuest();
  const { width } = useWindow();
  const handleView = (newView?: any) => {
    // console.log({request, fields})
    // const handleReloadScroll = () => {
    //   setScrollTo("product-build")
    // }
    // handleReloadScroll()
    // const checkL = () => {
    if (guest) {
      return openModal({
        dismissable: false,
        confirm: {
          title: `Success!, go check ${guest?.email}`,
          statements: [
            {
              label: 'Continue', onClick: () => {
                clearForm();
                setView('usage')
              }
            },

            // { label: 'GO Home', onClick: clearForm },
          ],
        },
      });
    }
    else if (request && request?.length) {
      return openModal({
        dismissable: false,
        confirm: {
          title: 'Continue where you left off?',
          statements: [
            { label: 'Continue', onClick: () => setView('build') },
            { label: 'Restart', onClick: clearForm },
          ],
        },
      });
    }
    if (!view) setView(String(firstView));
    const navViews = ['next', 'back'];
    setLasView(view);

    if (newView && !navViews.includes(newView)) {
      setView(newView);
      // HANDLE ACTIONS
    } else if (newView == 'back') {
      // console.log({ FUNC: "actionViews", view });
      switch (view) {
        case 'build':
          setView(firstView);
          break;
        case 'build':
          setView('usage');
          break;
        case 'contact':
          setView('build');
          break;
        default:
          break;
      }
    } else if (newView == 'next') {
      // console.log({ FUNC: "actionViews", view });
      switch (view) {
        case firstView:
          setView('build');
          break;
        default:
          break;
      }
    }
  };
  const handleForm = useCallback(
    (e: any, requestPath?: string | string[]) => {
      if (!loading?.active) setLoading({ active: true });

      const { name, value, checked, type } = e?.target || {};
      if (!name) return;
      // console.log({ name, value, checked })
      const fieldData = { name, value, checked, type };

      if (requestPath) {
        // console.log({requestPath})
        // if(requestPath == 'user'){
        //   setField({ ...fieldData });
        // }
        setField({ ...fieldData, path: requestPath });
      } else {
        setField(fieldData);
      }

      const currentChecked = fields ? findField(fields, name) : undefined;
      if (name === 'usage' && value && !currentChecked) {
        handleView('build');
      }

      return setLoading({ active: false });
    },
    [setField, loading],
  );

  const combineSessionValues = (kie: any) => {
    if (typeof kie == 'string') return defaultProductBuild?.[kie]?.data.map((option: IFormField) => {
      const field = fields?.find((f) => f.name === option.name && f.value === option.value);
      return {
        ...option,
        checked: field?.checked || false,
        quantity: Number(field?.quantity) > 0 ? Number(field?.quantity) : 1,
      };
    });
  };
  const calculateTotal = (items: IFormField[]) => {
    return items.reduce((total, item) => {
      if (item.checked && !isNaN(Number(item.value))) {
        const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        return total + Number(item.value) * qty;
      }
      return total;
    }, 0);
  };
  const handleQuantity = (name: string, value: any, quantity: number) => {
    setField({ name, value, quantity, type: 'checkbox', checked: quantity !== 0, path: 'metadata.build.data' });
  };
  const handleSubmit = async (e: any) => {
    setLoading({ active: true });
    console.log("[ HANDLE SUB ]", { fields, e })
    onSubmit && await onSubmit?.()
    setLoading({ active: false });
  }

  const views: any = {
    usage: (
      <ProductBuildUsageView
        options={combineSessionValues('usage')}
        onSelect={(e: any) => handleForm(e, 'metadata.build')}
      />
    ),
    build: (
      <>
        <ProductBuildQualify
          options={combineSessionValues('build')}
          onSelect={(e: any) => handleForm(e, 'metadata.build.data')}
          onQuantity={handleQuantity}
        />
      </>
    ),
    contact: <ContactForm
      submit={{ text: `Join ${keyStringConverter(environment.merchant.name)}` }}
      fieldErrors={fieldErrors}
      title=""
      onChange={(e: any) => {
        handleForm(e, 'user')
      }}
      onSubmit={handleSubmit}
      user={user}
    />,
    'invalid': <div className='product-quote__invalid'>
      <div className='product-quote__invalid--status'>
        Invalid<UiIcon icon='fa-exclamation-triangle' />
      </div>
      <div className='product-quote__invalid--message'>{message || ''}</div>
      <UiButton onClick={() => handleView('contact')}>return to contact productForm</UiButton>
    </div>,
    success
      : <div className='success d-flex-col g-5'>
        <h1 className='product-quote__success--status s-1' >

          Success <UiIcon icon='fa-circle-check' />
        </h1>
        <div>
          A verification email to
          <span className='product-quote__success--email'> {message}, </span>
          has been sent.
        </div>
        <div>To complete the process, simply click on the link in the email.</div>
        <UiButton href="/">home</UiButton>
      </div>,
    error: <div className='c-error'>
      <h1>An error occurred</h1>
    </div>
  };




  useEffect(() => {

    if (response) {
      setLoading({ active: false })
      if (response?.email) {
        handleView('success');
        setMessage(response.email);
      } else if (response?.status) {
        handleView(response.status);
        setMessage(response.message);
      }
    } else if (request) handleView();
    // console.log({R:request?.length})
  }, [request, response]);


  const viewKeys = ['usage', 'build', 'contact'];
  const viewKeysLen = viewKeys.length;
  const currentStepIndex = view ? viewKeys.indexOf(view) : -1;
  const currentStepNumber = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
  const showProgressHeader = currentStepIndex >= 0;

  const buttonsList = () => {
    const isDisabled = () => {
      if (view == 'usage') {
        // HAS FIELD VALUES
        if (fields && fields.length > 0) {
          return false;
        }
        return true;
      }
      if (view == 'build' && !fieldsComplete) return true;
      return false;
    };
    const nextViewKey = currentStepIndex >= 0 ? viewKeys?.[currentStepIndex + 1] : undefined;
    type NavButton = {
      name: string;
      children: string;
      variant?: string | boolean;
      disabled?: boolean;
      traits: {
        width: string;
        beforeIcon?: string;
        afterIcon?: string;
      };
    };

    const nextBtn = nextViewKey
      ? {
        name: 'next',
        children: nextViewKey,
        variant: isDisabled() && 'disabled',
        disabled: isDisabled(),
        traits: { afterIcon: "fa-chevron-right", width: "max-content" },
      }
      : undefined;
    const backBtn = { name: 'back', children: lastView ?? "", traits: { beforeIcon: "fa-chevron-left", width: "max-content", }, }
    const buttons: NavButton[] = [backBtn];
    if (nextBtn) buttons.push(nextBtn);
    return buttons;
  }

  const currentView = views?.[view ?? ''];
  const firstView = Object.keys(views)?.[0];
  const fieldsComplete = fields && calculateTotal(fields) > 20;
  const buildComplete = view == 'build' && fieldsComplete;
  const barGraphData: any = currentStepNumber
    ? [
      { count: currentStepNumber, date: `Step ${currentStepNumber} of ${viewKeysLen}` },
      { count: viewKeysLen, date: '' },
    ]
    : null;
  return (
    <>
      <style jsx>{styles}</style>


      <div className="product-build-layout">


        <div className="product-build-media">
          <UiMedia
            src={`${serverUrl}/files/srv/nirv1/broll/${{
              usage: 'housePanel',
              build: 'SolarPanelDesert',
              contact: 'nirvTeam',
            }[view ?? 'usage'] ?? 'housePanel'}.png`}
            variant='image'
            type='image'
          />
        </div>
        <div id="product-build" className="product-build">

          {(showProgressHeader && (
            <>
              <div className="product-build--header">
                {/* <div className="product-build--hea der__marquee"> */}
                {view == 'build' && fields &&
                  <p>{calculateTotal(fields)} Total Amps</p>}
                {/* </div> */}
                <div className="product-build--header__nav">

                  <UiButtonGroup
                    onSelect={(e: any) => handleView(e?.target?.name)}
                    btns={buttonsList()
                      .filter(Boolean)
                      .map((btn: any) => ({
                        name: btn.name,
                        label: btn.children,
                        traits: btn.traits,
                        disabled: btn.disabled,
                        size: "sm",
                        variant: btn.disabled ? 'disabled' : 'flat',
                      }))}
                    // traits={{size:"xs"}}
                    variant="bundle"
                  />
                </div>

              </div>
              {showProgressHeader && barGraphData &&
                <div className="product-build__progress">

                  <UiBarGraph data={barGraphData} variant="progress" />
                </div>}

              {/* <UiBarGraph data={data} /> */}
            </>
          )) || <div className="product-build--no-header"></div>}
          {buildComplete && (
            <div className="product-build__submit ">
              <UiButton size="xxl"
                variant="primary" onClick={() => handleView("contact")} disabled={!buildComplete}>
                Get Your Estimate
              </UiButton>
            </div>
          )}
          <div className="product-build--bg-primary">
            <div className="product-build--body__description">{defaultProductBuild?.[String(view)]?.description}</div>
            {currentView}
          </div>



        </div>
      </div>
    </>
  );
};

export default ProductBuild;
