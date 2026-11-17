// Test-only navigation: exercises the PIN form without weakening server authorization.
export async function openPage(page,url,role=null){
  let response=await page.goto(url);
  if(await page.locator('#access-form').count()){
    role=role||await page.locator('[name=role]').inputValue();
    const pin=process.env[role==='admin'?'TEST_ADMIN_PIN':'TEST_STAFF_PIN'];
    if(!pin)throw Error('Set TEST_ADMIN_PIN and TEST_STAFF_PIN for the isolated test server.');
    await page.locator('#access-pin').fill(pin);
    if(await page.locator('[name=role]').inputValue()!==role){
      // A staff test starts on the scan route; roles are selected by the requested page.
      throw Error('Test role does not match access page.');
    }
    const navigation=page.waitForNavigation();await page.locator('#access-submit').click();response=await navigation;
  }
  if(await page.locator('body[data-page=access]').count())throw Error('PIN access is not configured or test login failed.');
  return response;
}
