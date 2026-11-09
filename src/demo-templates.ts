/**
 * Contract templates for the demo. Fill-in places are Ophx template fields; field ids are
 * unique within a template. Simplified samples, not legal advice.
 */

export interface DemoTemplate {
  id: string
  title: string
  description: string
  html: string
}

/** Inline template field, required unless `required` is false. */
function field(id: string, label: string, required = true): string {
  const requiredAttribute = required ? ' data-ophx-required="true"' : ''
  return `<span class="ophx-field" contenteditable="true" data-ophx-field="${id}" data-ophx-label="${label}"${requiredAttribute}></span>`
}

function party(id: string, role: string): string {
  return `<p>${field(`${id}_name`, `${role}: наименование`)}</p>
    <p>ИНН: ${field(`${id}_inn`, `${role}: ИНН`)}</p>
    <p>Адрес: ${field(`${id}_address`, `${role}: адрес`)}</p>`
}

function signatures(left: [string, string], right: [string, string]): string {
  return `<h2>Реквизиты сторон</h2>
<table>
  <tr><th>${left[1]}</th><th>${right[1]}</th></tr>
  <tr><td>${party(...left)}</td><td>${party(...right)}</td></tr>
</table>`
}

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    id: 'supply',
    title: 'Договор поставки',
    description: 'Товар по спецификации, предоплата',
    html: `<h1>Договор поставки № ${field('number', 'Номер')}</h1>
<p>г. ${field('city', 'Город')}, ${field('date', 'Дата')}</p>
<p>${field('supplier', 'Поставщик')}, именуемый в дальнейшем «Поставщик», и ${field('buyer', 'Покупатель')}, именуемый в дальнейшем «Покупатель», заключили настоящий договор о нижеследующем.</p>
<h2>1. Предмет договора</h2>
<p>Поставщик обязуется передать в собственность Покупателя товар, а Покупатель — принять и оплатить его.</p>
<table>
  <tr><th>Товар</th><th>Количество</th><th>Цена, ₽</th></tr>
  <tr><td><p>${field('item_name', 'Наименование')}</p></td><td><p>${field('item_qty', 'Количество')}</p></td><td><p>${field('item_price', 'Цена')}</p></td></tr>
</table>
<h2>2. Оплата и поставка</h2>
<p>Общая стоимость товара — ${field('total', 'Сумма, ₽')} рублей. Предоплата ${field('prepay', 'Предоплата, %')}% вносится в течение 5 рабочих дней с даты подписания договора.</p>
<p>Срок поставки — ${field('delivery_term', 'Срок поставки')}, по адресу: ${field('delivery_address', 'Адрес поставки')}.</p>
<h2>3. Ответственность</h2>
<p>За просрочку оплаты или поставки виновная сторона уплачивает неустойку ${field('penalty', 'Неустойка, %', false)}% от суммы просроченного обязательства за каждый день просрочки.</p>
${signatures(['supplier', 'Поставщик'], ['buyer', 'Покупатель'])}`,
  },
  {
    id: 'services',
    title: 'Договор оказания услуг',
    description: 'Услуги с приёмкой по акту',
    html: `<h1>Договор оказания услуг № ${field('number', 'Номер')}</h1>
<p>г. ${field('city', 'Город')}, ${field('date', 'Дата')}</p>
<p>${field('contractor', 'Исполнитель')}, именуемый в дальнейшем «Исполнитель», и ${field('customer', 'Заказчик')}, именуемый в дальнейшем «Заказчик», заключили настоящий договор о нижеследующем.</p>
<h2>1. Предмет договора</h2>
<p>Исполнитель обязуется оказать Заказчику следующие услуги: ${field('services', 'Перечень услуг')}, а Заказчик — принять и оплатить их.</p>
<p>Срок оказания услуг: с ${field('start', 'Начало')} по ${field('end', 'Окончание')}.</p>
<h2>2. Стоимость и оплата</h2>
<p>Стоимость услуг — ${field('price', 'Стоимость, ₽')} рублей. Оплата в течение ${field('pay_days', 'Дней на оплату')} рабочих дней после подписания акта.</p>
<h2>3. Приёмка</h2>
<p>Заказчик в течение 5 рабочих дней подписывает акт или направляет мотивированный отказ. Если ответа нет, услуги считаются принятыми.</p>
${signatures(['contractor', 'Исполнитель'], ['customer', 'Заказчик'])}`,
  },
]
