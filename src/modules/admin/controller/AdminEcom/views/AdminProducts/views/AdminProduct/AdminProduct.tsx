import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { getService } from '@webstack/common';
import IAdminService from '~/src/core/services/AdminService/IAdminService';
import useDeleteProduct from '../../hooks/useDeleteProduct';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import UiButton from '@webstack/components/UiForm/components/UiButton/UiButton';
import styles from './AdminProduct.scss';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import environment from '~/src/core/environment';
import { useNotification } from '@webstack/components/Notification/Notification';
import useSessionStorage from '@webstack/hooks/storage/useSessionStorage';
import { IProduct } from '~/src/models/Shopping/IProduct';

const AdminProduct: React.FC<{ product?: any, products?: IProduct[] | null }> = ({ product, products }) => {
  const router = useRouter();
  const mid = environment.merchant.mid;
  const adminService = getService<IAdminService>('IAdminService');
  const { initiateDelete } = useDeleteProduct();
  const [notification, setNotification] = useNotification();
  const { loading: sessionLoading, getSessionItem, setSessionItem, deleteSessionItem } = useSessionStorage();

  const [fields, setFields] = useState<IFormField[]>([]);
  const [productMetadata, setProductMetadata] = useState<IFormField[]>([]);
  const [prices, setPrices] = useState<IFormField[][]>([]);
  const [priceMetadata, setPriceMetadata] = useState<IFormField[][]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string, value: string }[]>([]);

  // Preload the existing image files into state
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  type FormSnapshot = {
    fields: IFormField[];
    productMetadata: IFormField[];
    prices: IFormField[][];
    priceMetadata: IFormField[][];
  };

  const serverSnapshotRef = useRef<FormSnapshot | null>(null);
  const [usingDraft, setUsingDraft] = useState<boolean>(false);
  const [hasServerDiff, setHasServerDiff] = useState<boolean>(false);

  const draftKey = product?.id ? `admin-product-${mid}-${product.id}` : `admin-product-${mid}-new`;


  function getInitialPriceFields(
    includeTax = 'no',
    taxRate = '0.00',
    existing?: any,
    includeProductImagesField: boolean = false,
  ): IFormField[] {
    const priceImagesValue: string[] =
      existing?.metadata && typeof existing.metadata === 'object'
        ? Object.entries(existing.metadata)
          .filter(
            ([key, value]) =>
              key.startsWith('img_') && (typeof value === 'string' || typeof value === 'number'),
          )
          .sort(([aKey], [bKey]) => (aKey < bKey ? -1 : aKey > bKey ? 1 : 0))
          .map(([, value]) => String(value))
        : [];
    const fields: IFormField[] = [
      {
        name: 'nickname',
        label: 'Price Name',
        type: 'text',
        value: existing?.nickname || '',
        placeholder: 'add name',
      },
      {
        name: 'unit_amount',
        label: 'Amount (USD)',
        type: 'text',
        value: existing?.unit_amount ? String(existing.unit_amount / 100) : '',
        traits: { mask: 'currency' },
      },
      { name: 'recurring', type: 'checkbox', label: 'recurring' },
      {
        name: 'include_tax',
        label: 'Include Tax',
        type: 'select',
        value: includeTax,
        options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
      },
      {
        name: 'price_images',
        label: 'Price Images',
        type: 'file',
        multiple: true,
        accept: '*/*',
        value: priceImagesValue,
      },
    ];
    if (includeProductImagesField) {
      fields.splice(4, 0, { name: 'file', label: 'Product images', type: 'file', multiple: true, accept: '*/*', value: imageFiles });
    }
    if (includeTax === 'yes') {
      fields.push({
        name: 'tax_rate',
        label: 'Sales Tax Rate',
        type: 'select',
        value: taxRate,
        options: [
          { label: 'No Tax (0%)', value: '0.00' },
          { label: 'Standard (7.45%)', value: '0.0745' },
          { label: 'Custom (10%)', value: '0.10' },
        ],
      });
    }
    return fields;
  }

  const onChange = (e: any, index?: number, isPriceMeta?: boolean) => {
    let { name, value, files } = e.target;
    name = name.replace(/^metadata\./, '');
    const val = value?.value !== undefined ? value?.value : value;

    if ((files && files.length > 0) || val instanceof File) {
      const newFiles = files ? Array.from(files) : [val];
      if (typeof index === 'number') {
        const updated: any = [...prices];
        updated[index] = updated[index].map((f: any) => {
          if (f.name === name) {
            const prev = Array.isArray(f.value) ? f.value : f.value ? [f.value] : [];
            return { ...f, value: [...prev, ...newFiles] };
          }
          return f;
        });
        return setPrices(updated);
      }
    }

    if (typeof index === 'number') {
      const updated = [...(isPriceMeta ? priceMetadata : prices)];

      updated[index] = updated[index].map(f => {
        if (f.name === name) {
          return { ...f, value: val };
        }
        return f;
      });

      isPriceMeta ? setPriceMetadata(updated) : setPrices(updated);
    } else {
      const isMeta = productMetadata.some(f => f.name === name);
      const isMain = fields.some(f => f.name === name);
      if (isMeta) {
        setProductMetadata(prev => prev.map(f => f.name === name ? { ...f, value: val } : f));
      } else if (isMain) {
        setFields(prev => prev.map(f => f.name === name ? { ...f, value: val } : f));
      } else {
        console.warn(`Unknown field name "${name}"`);
      }
    }
  };

  const taxRateOptions = [
    { label: 'No Tax (0%)', value: '0.00' },
    { label: 'Standard (7.45%)', value: '0.0745' },
    { label: 'Custom (10%)', value: '0.10' },
  ];

  const onDelete = async () => {
    try {
      const res = await initiateDelete({ id: product.id, price_id: product?.price?.id, name: product.name });
      // console.log("res", res);
      if (res?.id || res?.success) {
        setNotification({
          active: true,
          list: [{
            label: 'Product Deleted',
            message: `"${product.name}" has been deleted successfully.`,
            onClick: () => router.push('/admin?vid=products', undefined, { shallow: false }),
          }],
        });
      }
    } catch (err: any) {
      setNotification({
        active: true,
        apiError: {
          error: true,
          status: err?.status || 400,
          message: err?.message || 'Failed to delete product',
          detail: err?.response?.data?.detail || err?.detail || 'Unexpected error',
        },
        persistence: 5000,
      });
    }
  };
  function getTimeWithString(message: string) {
    // Get current time
    const now = new Date();

    // Format hours, minutes, seconds with leading zeros
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // Combine into HH:MM:SS format
    const timeString = `${hours}:${minutes}:${seconds}`;

    // Return the time and the provided string
    return `${timeString} - ${message}`;
  }

  // useEffect(() => {
  //   const testValues = fields.map(
  //     f=>{if(f?.type?.includes('text')&&!f?.value) f.value=getTimeWithString(f.name);return f;}
  //   )
  //   console.log("testValues", testValues);motor controller rcrc
  // },[fields]);



  useEffect(() => {
    const categorySet = new Set<string>();
    products?.forEach(p => {
      const cat = p?.metadata?.category;
      if (cat) categorySet.add(cat);
    });

    const options = Array.from(categorySet).map(cat => ({ label: cat, value: cat }));
    const currentCategory = product?.metadata?.category;
    if (currentCategory && !options.find(opt => opt.value === currentCategory)) {
      options.push({ label: currentCategory, value: currentCategory });
    }

    setCategoryOptions(options);
    const baseFields: IFormField[] = [
      { name: 'name', label: 'Product Name', type: 'text', required: true, value: product?.name || '' },
      { name: 'description', label: 'Description', type: 'textarea', value: product?.description || '' },
      { name: 'active', label: 'Active', type: 'checkbox', value: product?.active ?? true },
      {
        name: 'marketing_features',
        label: 'Marketing Features',
        type: 'multi-select',
        value: product?.marketing_features || [],
        options: [
          { label: 'AI Generated', value: 'ai_generated' },
          { label: 'Verified Creator', value: 'verified_creator' },
          { label: 'Premium Support', value: 'premium_support' },
          { label: 'Early Access', value: 'early_access' },
        ],
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        value: currentCategory || '',
        options,
        input: true,
      },
    ];

    const metadataFields: IFormField[] = [];
    if (product?.metadata) {
      Object.entries(product.metadata).forEach(([key, value]) => {
        if (key === 'mid' || key === 'metadata.category') return; // Remove redundant fields
        metadataFields.push({
          name: `metadata.${key}`,
          label: key,
          type: 'text',
          value: String(value),
        });
      });
    }
    const baseProductMetadata = metadataFields;

    let basePrices: IFormField[][] = [];
    let basePriceMetadata: IFormField[][] = [];

    // Prefer explicit prices array when present
    if (Array.isArray((product as any)?.prices) && (product as any).prices.length > 0) {
      const pricesArray: any[] = (product as any).prices;
      basePrices = pricesArray.map((p, index) =>
        getInitialPriceFields(
          p.tax_behavior === 'inclusive' ? 'yes' : 'no',
          p.tax_rate || '0.00',
          p,
          index === 0,
        ),
      );
      basePriceMetadata = pricesArray.map((p) =>
        p.metadata
          ? Object.entries(p.metadata)
            .filter(([key]) => !key.startsWith('img_'))
            .map(([key, value]) => ({
              name: key,
              label: key,
              type: 'text',
              value: String(value),
            }))
          : [],
      );
    } else if (product?.price && typeof product.price === 'object') {
      const priceFields = getInitialPriceFields(
        product.price.tax_behavior === 'inclusive' ? 'yes' : 'no',
        product.price.tax_rate || '0.00',
        product.price,
        true,
      );
      basePrices = [priceFields];
      basePriceMetadata = [
        product.price.metadata
          ? Object.entries(product.price.metadata)
            .filter(([key]) => !key.startsWith('img_'))
            .map(([key, value]) => ({
              name: key,
              label: key,
              type: 'text',
              value: String(value),
            }))
          : [],
      ];
    } else {
      basePrices = [getInitialPriceFields('no', '0.00', undefined, true)];
      basePriceMetadata = [[]];
    }

    serverSnapshotRef.current = {
      fields: baseFields,
      productMetadata: baseProductMetadata,
      prices: basePrices,
      priceMetadata: basePriceMetadata,
    };

    if (!sessionLoading) {
      const stored = getSessionItem(draftKey);
      const draft = stored?.value as FormSnapshot | undefined;

      const draftPricesLen = draft?.prices ? draft.prices.length : 0;
      const serverPricesLen = basePrices.length;

      const hasCompatibleDraft =
        !!draft &&
        Array.isArray(draft.fields) &&
        Array.isArray(draft.prices) &&
        // allow drafts that have at least as many prices as the server
        draftPricesLen >= serverPricesLen;

      if (hasCompatibleDraft) {
        setFields(draft!.fields);
        setProductMetadata(draft!.productMetadata || []);
        setPrices(draft!.prices);
        setPriceMetadata(draft!.priceMetadata || draft!.prices.map(() => []));
        setUsingDraft(true);
        try {
          const server = serverSnapshotRef.current;
          if (server) {
            setHasServerDiff(JSON.stringify(draft) !== JSON.stringify(server));
          }
        } catch {
          setHasServerDiff(true);
        }
      } else {
        // Either no draft or incompatible (e.g., server now has more prices)
        if (stored) {
          deleteSessionItem(draftKey);
        }
        setFields(baseFields);
        setProductMetadata(baseProductMetadata);
        setPrices(basePrices);
        setPriceMetadata(basePriceMetadata);
        setUsingDraft(false);
        setHasServerDiff(false);
      }
    } else {
      // Fallback to server values while session storage is initializing
      setFields(baseFields);
      setProductMetadata(baseProductMetadata);
      setPrices(basePrices);
      setPriceMetadata(basePriceMetadata);
    }

    // Preload the existing image files into the imageFiles state
    if (product?.images && product.images.length > 0) {
      const existingFiles = product.images.map((image: string) => {
        return {
          src: image, // Use the image URL directly for rendering
          alt: `Product image`, // Alt text for accessibility
        };
      });
      setImageFiles(existingFiles);
    }
  }, [products, product, sessionLoading]);

  // Helper to sanitize form data for session storage (File objects can't be serialized)
  const sanitizeForStorage = (pricesArr: IFormField[][]): IFormField[][] => {
    return pricesArr.map(priceFields =>
      priceFields.map(field => {
        if (field.type === 'file' && Array.isArray(field.value)) {
          // Keep only URL strings, filter out File objects and empty objects
          const sanitizedValue = (field.value as any[]).filter((v: any) =>
            typeof v === 'string' && v.length > 0 && (v.startsWith('http') || v.startsWith('/'))
          ) as string[];
          return { ...field, value: sanitizedValue } as IFormField;
        }
        return field;
      })
    );
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!serverSnapshotRef.current) return;

    // Sanitize prices for storage (remove File objects that can't be serialized)
    const sanitizedPrices = sanitizeForStorage(prices);

    const current: FormSnapshot = {
      fields,
      productMetadata,
      prices: sanitizedPrices,
      priceMetadata,
    };

    const server = serverSnapshotRef.current;
    const sanitizedServer = {
      ...server,
      prices: sanitizeForStorage(server.prices),
    };

    let differs = false;
    try {
      differs = JSON.stringify(current) !== JSON.stringify(sanitizedServer);
    } catch {
      differs = true;
    }

    setHasServerDiff(differs);

    if (differs) {
      setSessionItem(draftKey, current, { expiryMs: 1000 * 60 * 60 * 6 }); // 6 hours
      setUsingDraft(true);
    } else {
      deleteSessionItem(draftKey);
      setUsingDraft(false);
    }
  }, [fields, productMetadata, prices, priceMetadata, draftKey, sessionLoading]);

  const resetToServer = () => {
    const server = serverSnapshotRef.current;
    if (!server) return;

    setFields(server.fields);
    setProductMetadata(server.productMetadata);
    setPrices(server.prices);
    setPriceMetadata(server.priceMetadata);
    deleteSessionItem(draftKey);
    setHasServerDiff(false);
    setUsingDraft(false);
  };
  const onSubmit = async () => {
    const imageFiles: File[] = [];
    const priceImageMap: {
      priceIndex: number;
      images: { key: string; imageIndex: number }[];
    }[] = [];

    // Helper to check if a value is a valid uploadable File
    const isValidFile = (val: any): val is File => {
      return (
        val instanceof File &&
        typeof val.name === 'string' &&
        val.name.length > 0 &&
        val.size > 0 &&
        val.name.includes('.') // Must have an extension
      );
    };

    // Helper to extract a proper extension from a filename
    const getExtension = (filename: string): string => {
      const parts = filename.split('.');
      if (parts.length < 2) return 'jpg'; // fallback
      const ext = parts.pop()?.toLowerCase() || 'jpg';
      // Validate it's a reasonable image extension
      const validExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
      return validExts.includes(ext) ? ext : 'jpg';
    };

    prices.forEach((priceFields, index) => {
      // Product-level images: only taken from the first price section
      if (index === 0) {
        const fileField = priceFields.find(f => f.name === 'file');
        const files = Array.isArray(fileField?.value) ? fileField.value : fileField?.value ? [fileField.value] : [];
        files.forEach((file: any, i: number) => {
          if (isValidFile(file)) {
            const nickname = String(priceFields.find(f => f.name === 'nickname')?.value || `price_${index}`);
            const ext = getExtension(file.name);
            imageFiles.push(new File([file], `${nickname}_${index}_${i}.${ext}`, { type: file.type }));
          }
        });
      }

      const priceImagesField = priceFields.find(f => f.name === 'price_images');
      const priceImages = Array.isArray(priceImagesField?.value)
        ? priceImagesField.value
        : priceImagesField?.value
          ? [priceImagesField.value]
          : [];

      // Count existing URL/string entries (valid URLs only) so new uploads can append
      const existingUrlCount = priceImages.filter((v: any) => {
        if (v instanceof File) return false;
        // Only count actual URL strings, not empty objects or invalid values
        return typeof v === 'string' && v.length > 0 && (v.startsWith('http') || v.startsWith('/'));
      }).length;
      const bindingsForPrice: { key: string; imageIndex: number }[] = [];
      let fileOrdinal = 0;

      priceImages.forEach((file: any) => {
        if (isValidFile(file)) {
          const nickname = String(priceFields.find(f => f.name === 'nickname')?.value || `price_${index}`);
          const ext = getExtension(file.name);
          const baseName = `${nickname}_${index}_pimg_${fileOrdinal}`;
          const newFile = new File([file], `${baseName}.${ext}`, { type: file.type });
          const imageIndex = imageFiles.length;
          imageFiles.push(newFile);
          fileOrdinal += 1;
          const keyIndex = existingUrlCount + fileOrdinal;
          bindingsForPrice.push({ key: `img_${keyIndex}`, imageIndex });
        }
      });

      if (bindingsForPrice.length) {
        priceImageMap.push({ priceIndex: index, images: bindingsForPrice });
      }
    });

    const pricesData = prices.map((fields, index) => {
      const price = Object.fromEntries(fields.map(f => [f.name, f.value]));
      const priceImagesField = fields.find(f => f.name === 'price_images');
      const priceImages = Array.isArray(priceImagesField?.value)
        ? priceImagesField.value
        : priceImagesField?.value
          ? [priceImagesField.value]
          : [];
      const billingPeriod = price.billing_period;
      const nickname = String(price.nickname || `price_${index}`).trim().replace(/\s+/g, '_');

      const meta: Record<string, any> = {};
      (priceMetadata[index] || []).forEach(f => {
        meta[f.name] = f.value;
      });

      // Re-attach any existing URL-based price images as img_1, img_2, ...
      // Only include valid URL strings, skip empty objects or invalid values
      let urlIndex = 0;
      priceImages.forEach((val: any) => {
        if (val instanceof File) return;
        if (val == null) return;
        // Only include actual URL strings
        if (typeof val === 'string' && val.length > 0 && (val.startsWith('http') || val.startsWith('/'))) {
          urlIndex += 1;
          meta[`img_${urlIndex}`] = val;
        }
        // Skip empty objects, numbers, or other invalid values
      });

      return {
        nickname,
        unit_amount: price.unit_amount
          ? Math.round(parseFloat(String(price.unit_amount).replace(/[^\d.]/g, '')) * 100)
          : 0,
        currency: 'usd',
        tax_behavior: price.include_tax === 'yes' ? 'inclusive' : 'exclusive',
        billing_scheme: 'per_unit',
        ...(price.include_tax === 'yes' && typeof price.tax_rate === 'string' && { tax_rate: price.tax_rate }),
        ...(billingPeriod !== 'one_time' && billingPeriod !== 'custom' && {
          recurring: {
            interval: ['day', 'week', 'month', 'year'].includes(String(billingPeriod)) ? String(billingPeriod) : 'month',
            interval_count: billingPeriod === 'quarter' ? 3 : billingPeriod === 'biannual' ? 6 : 1,
          },
        }),
        metadata: meta,
      };
    });

    const categoryValue = fields.find(f => f.name === 'category')?.value || '';

    const payload: any = {
      metadata: Object.fromEntries([
        ['mid', mid],
        ...productMetadata.map(f => [f.name, f.value]),
        ['category', categoryValue],
      ]),
      name: fields.find(f => f.name === 'name')?.value || '',
      description: fields.find(f => f.name === 'description')?.value || '',
      active: fields.find(f => f.name === 'active')?.value || false,
      marketing_features: fields.find(f => f.name === 'marketing_features')?.value || [],
      price: pricesData,
      merchant_id: mid,
      // Filter to only include actual File instances with valid names
      imageFiles: imageFiles.filter(f => f instanceof File && f.name && f.size > 0),
      priceImageMap,
    };

    // Validate that all collected image files are actual File instances
    // (The filter above should guarantee this, but double-check)
    const validatedFiles = payload.imageFiles as File[];
    if (validatedFiles.length > 0 && !validatedFiles.every(f => f instanceof File)) {
      return setNotification({
        active: true,
        apiError: {
          error: true,
          status: 400,
          message: 'One or more uploaded files are invalid.',
          detail: 'Ensure all image fields have valid image files.',
        },
      });
    }

    if (product?.id) payload.id = product.id;
    try {
      const response = await adminService.createProduct(payload);
      if (response?.id) {
        setNotification({
          active: true,
          list: [
            {
              label: "Product Created Successfully!",
              message: `"${response.name}" was created successfully.`,
              onClick: () => router.push(`/services`),
            },
          ],
        });
      }
    } catch (error: any) {
      setNotification({
        active: true,
        apiError: {
          error: true,
          status: error?.status || 400,
          message: error?.message || 'Failed to create product',
          detail: error?.response?.data?.detail || error?.detail || 'Unexpected error',
        },
        persistence: 5000,
      });
    }
  };

  return (
    <>
      <style jsx>{styles}</style>
      <div className="admin-product">
        {(usingDraft || hasServerDiff) && (
          <div className="admin-product__draft-banner">
            <div>
              {hasServerDiff
                ? 'Local draft differs from server. Changes are saved in this browser session.'
                : 'Using local draft in sync with server data.'}
            </div>
            {hasServerDiff && (
              <UiButton variant="link" traits={{ afterIcon: 'fa-rotate-left' }} onClick={resetToServer}>
                Reset to server
              </UiButton>
            )}
          </div>
        )}
        <div className="admin-product__section">
          <UiForm title={product?.id ? 'Edit Product' : 'Add Product'} fields={fields} onChange={(e) => onChange(e)} />
          <UiForm
            key={`product-meta-${productMetadata.length}`}
            title="Product Metadata"
            fields={productMetadata}
            onChange={(e) => onChange(e)}
            onAddField={(e) => {
              let { name, value } = e.target;
              name = name.replace(/^metadata\./, '');
              if (!productMetadata.find(f => f.name === name)) {
                setProductMetadata(prev => [...prev, { name, label: value || name, type: 'text', value: '' }]);
              }
            }}
          />
        </div>

        {prices.map((price, index) => {
          const nicknameField = price.find((f) => f.name === 'nickname');
          const nicknameVal =
            typeof nicknameField?.value === 'string'
              ? nicknameField.value.trim()
              : '';
          const titleNickname = nicknameVal || 'add name';

          return (
            <div className="admin-product__section" key={index}>
              <UiForm
                title={titleNickname ? `Price ${index + 1}: ${titleNickname}` : `Price ${index + 1}`}
                onChange={(e) => onChange(e, index)}
                fields={price}
              />
              <UiForm
                key={`price-meta-${index}`}
                title={`Price ${index + 1} Metadata`}
                fields={priceMetadata[index] || []}
                onChange={(e) => onChange(e, index, true)}
                onAddField={(e) => {
                  let { name, value } = e.target;
                  name = name.replace(/^metadata\./, '');
                  setPriceMetadata(prev => {
                    const updated = [...prev];
                    if (!updated[index]) updated[index] = [];
                    if (!updated[index].find(f => f.name === name)) {
                      updated[index].push({ name, label: value || name, type: 'text', value: '' });
                    }
                    return updated;
                  });
                }}
              />
              <UiIcon icon="fa-trash-can" onClick={() => {
                setPrices(prev => prev.filter((_, i) => i !== index));
                setPriceMetadata(prev => prev.filter((_, i) => i !== index));
              }} />
            </div>);
        })}

        <UiButton
          variant="link"
          traits={{ afterIcon: 'fa-dollar-sign-circle' }}
          onClick={() => {
            setPrices(prev => [...prev, getInitialPriceFields('no', '0.00', undefined, prev.length === 0)]);
            setPriceMetadata(prev => [...prev, []]);
          }}
        >
          Add Price
        </UiButton>

        <UiButton variant="glow" onClick={onSubmit}>
          {product?.id ? 'Save Changes' : 'Add Product'}
        </UiButton>

        {product?.id && (
          <UiButton
            variant="danger"
            traits={{ afterIcon: 'fa-trash-can' }}
            onClick={async () => {
              await onDelete();
            }}
          >
            Delete Product
          </UiButton>
        )}
      </div>
    </>
  );
};

export default AdminProduct;
