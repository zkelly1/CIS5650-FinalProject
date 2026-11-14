export async function demoLabel(page, title, detail) {
  await page.evaluate(({title,detail})=>{
    const heading=document.querySelector('h1');
    heading.textContent=title;
    heading.style.cssText='font-size:32px;color:#a9c5ff';
    const body=heading.nextElementSibling;
    body.textContent=detail;
    body.style.cssText='font-size:18px;color:#edf2fc';
  },{title,detail});
}
