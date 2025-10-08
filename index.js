/*
 * GPMF Gold Token 관리자 페이지
 * Network: BSC Mainnet (Chain ID: 56) ONLY
 */
let Network = 56; // BSC Mainnet
const NETWORKS = { "56": "bsc" };

// ====== 유틸 ======

// ====== 에러/연결 공통 처리 ======
function friendlyError(e) {
  try {
    // Trust Wallet / EIP-1193 user rejected
    if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED' || (e.message || '').toLowerCase().includes('user rejected'))) {
      return '트랜잭션을 취소하였습니다.';
    }
    const msg = (e?.data?.message) || (e?.error?.message) || (e?.message) || String(e);

    // 네트워크/컨트랙트 관련 오류 처리 강화
    if (/Returned values aren't valid|did it run Out of Gas|not using the correct ABI|requesting data from a block number that does not exist|node which is not fully synced/i.test(msg)) {
      return '선택된 네트워크에서 컨트랙트를 찾을 수 없습니다. 상단에서 올바른 네트워크(BSC Mainnet)를 선택했는지 확인해주세요.';
    }

    // 컨트랙트 호출 실패 관련
    if (/execution reverted|call exception|contract call failed/i.test(msg)) {
      return '컨트랙트 호출에 실패했습니다. 네트워크 연결 상태와 컨트랙트 주소를 확인해주세요.';
    }

    // 잘 알려진 케이스 매핑
    if (/insufficient funds/i.test(msg) || e?.code === 'INSUFFICIENT_FUNDS') return '지갑 잔액이 부족합니다.';
    if (/nonce too low/i.test(msg)) return '논스가 낮습니다. 지갑을 새로고침하거나 잠시 후 다시 시도해주세요.';
    if (/replacement (fee|underpriced)/i.test(msg)) return '대체 트랜잭션 수수료가 낮습니다. 가스 가격/한도를 높여 재시도하세요.';
    if (e?.code === 'UNPREDICTABLE_GAS_LIMIT' || /gas required exceeds allowance|always failing transaction/i.test(msg)) return '가스 추정에 실패했습니다. 입력값, 권한, 컨트랙트 상태를 확인해주세요.';
    if (/invalid address/i.test(msg)) return '잘못된 주소 형식입니다.';
    if (/invalid (bignumber|number|uint)/i.test(msg)) return '숫자 형식이 올바르지 않습니다.';
    if (e?.code === 'CALL_EXCEPTION' || /call exception|execution reverted/i.test(msg)) {
      // revert reason 추출
      const m = msg.match(/reverted with reason string ['"]([^'"]+)['"]/i);
      return '컨트랙트 실행이 거부(revert)되었습니다' + (m ? `: ${m[1]}` : '');
    }
    if (/network error|chain|wrong network|unsupported chain id/i.test(msg)) return '네트워크 오류입니다. 상단에서 올바른 네트워크를 선택했는지 확인하세요.';

    return '오류: ' + msg;
  } catch (_) {
    return '알 수 없는 오류가 발생했습니다.';
  }
}

// ====== UI 상태 관리 ======
function updateUIState(isConnected) {
  const buttons = document.querySelectorAll('button:not(.btn-connect-wallet)');
  const links = document.querySelectorAll('.bscscan-links a');
  const networkSelect = document.getElementById('networkSelect');
  const body = document.body;

  buttons.forEach(btn => {
    btn.disabled = !isConnected;
    btn.style.cursor = isConnected ? 'pointer' : 'not-allowed';
    btn.style.opacity = isConnected ? '1' : '0.5';

    if (!isConnected) {
      btn.addEventListener('click', preventActionWhenDisconnected, { passive: false });
    } else {
      btn.removeEventListener('click', preventActionWhenDisconnected);
    }
  });

  links.forEach(link => {
    link.style.pointerEvents = isConnected ? 'auto' : 'none';
    link.style.cursor = isConnected ? 'pointer' : 'not-allowed';
    link.style.opacity = isConnected ? '1' : '0.5';

    if (!isConnected) {
      link.addEventListener('click', preventActionWhenDisconnected, { passive: false });
    } else {
      link.removeEventListener('click', preventActionWhenDisconnected);
    }
  });

  if (networkSelect) {
    networkSelect.disabled = false;
    networkSelect.style.cursor = 'pointer';
    networkSelect.style.opacity = '1';
  }

  if (isConnected) {
    body.classList.remove('wallet-not-connected');
  } else {
    body.classList.add('wallet-not-connected');
  }
}

function preventActionWhenDisconnected(event) {
  event.preventDefault();
  event.stopPropagation();
  alert('지갑을 먼저 연결해주세요.');
  return false;
}

async function ensureConnected() {
  if (!window.ethereum || !ethersProvider || !ethersSigner || !WalletAddress) {
    alert('지갑 연결 먼저 해주세요.');
    throw new Error('WALLET_NOT_CONNECTED');
  }
}

function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
function isValidAmount(amount, min = 1, max = 1000000000) {
  const num = Number(amount);
  return !isNaN(num) && num >= min && num <= max;
}
function fmtToken(bn) {
  try { return `${ethers.utils.formatEther(bn)} GPMF`; } catch (_) { return '-'; }
}
function fmtBNB(bn) {
  try { return `${ethers.utils.formatEther(bn)} BNB`; } catch (_) { return '-'; }
}

function rebuildProviders() {
  if (!window.ethereum) return;
  web3 = new Web3(window.ethereum);
  ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
  ethersSigner = ethersProvider.getSigner();
}

// 동적 입력 유틸
function createInput({ id, placeholder, className = 'form-input', type = 'text', attrs = {} }) {
  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.placeholder = placeholder;
  input.className = className;
  Object.entries(attrs).forEach(([k, v]) => input.setAttribute(k, v));
  return input;
}
function createRow(children = [], gap = '8px') {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = gap;
  row.style.flexWrap = 'wrap';
  children.forEach(ch => row.appendChild(ch));
  return row;
}

var WalletAddress = "";
var web3;
var ethersProvider;
var ethersSigner;

// ====== 초기화/지갑 ======
async function initializeWeb3() {
  if (typeof window.ethereum === 'undefined') {
    alert('Trust Wallet 또는 메타마스크를 설치해주세요.');
    return false;
  }
  try {
    web3 = new Web3(window.ethereum);
    ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
    ethersSigner = ethersProvider.getSigner();
    return true;
  } catch (e) {
    console.error('Web3 초기화 실패:', e);
    return false;
  }
}

async function addChainIfNeeded(chainIdHex) {
  if (chainIdHex === '0x38') { // BSC Mainnet: 56
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x38',
          chainName: 'BNB Smart Chain Mainnet',
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: ['https://bsc-dataseed1.binance.org'],
          blockExplorerUrls: ['https://bscscan.com']
        }]
      });
    } catch (e) { console.error(e); }
  }
}

// ====== 네트워크/링크 ======
function setupBscScanLinks() {
  if (!CONTRACT_ADDRESS) return;

  const baseUrl = "https://bscscan.com"; // BSC Mainnet only

  document.getElementById("bscscanContract").href =
    `${baseUrl}/address/${CONTRACT_ADDRESS}`;

  document.getElementById("bscscanTokenTracker").href =
    `${baseUrl}/token/${CONTRACT_ADDRESS}`;

  document.getElementById("bscscanHoldAddress").href =
    `${baseUrl}/token/${CONTRACT_ADDRESS}#balances`;
}

// 네트워크 변경 시에도 추가 확인
async function checkAndSwitchNetwork() {
  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    const target = '0x' + Number(Network).toString(16);

    if (currentChainId !== target) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: target }]
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await addChainIfNeeded(target);
        } else {
          throw switchError;
        }
      }
    }

    rebuildProviders();

    setupBscScanLinks();
    return true;
  } catch (e) {
    console.error('네트워크 전환 실패:', e);
    alert('네트워크 전환에 실패했습니다: ' + friendlyError(e));
    return false;
  }
}

async function testContractConnection() {
  if (!WalletAddress || !web3) {
    return true; // 지갑이 연결되지 않은 상태면 테스트 스킵
  }

  try {
    const c = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
    await c.methods.name().call(); // 간단한 호출로 연결 테스트
    return true;
  } catch (testError) {
    console.warn('컨트랙트 연결 테스트 실패:', testError);

    const errorMessage = testError?.message || String(testError);

    // 컨트랙트를 찾을 수 없는 경우의 에러 패턴 감지
    if (/Returned values aren't valid|did it run Out of Gas|not using the correct ABI|requesting data from a block number that does not exist|node which is not fully synced/i.test(errorMessage)) {
      alert(`BSC Mainnet에서 컨트랙트를 찾을 수 없습니다.\n\nsmartcontract.js에서 컨트랙트 주소가 올바른지 확인해주세요.\n\n현재 주소: ${CONTRACT_ADDRESS}`);
    } else {
      alert(`BSC Mainnet에서 컨트랙트 연결에 실패했습니다.\n\n오류: ${friendlyError(testError)}`);
    }

    return false;
  }
}

async function connectWallet() {
  const ok = await initializeWeb3();
  if (!ok) return;

  const switched = await checkAndSwitchNetwork();
  if (!switched) return;

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) {
    alert('지갑 연결 실패');
    return;
  }

  WalletAddress = accounts[0];
  document.getElementById('walletAddress').innerText = WalletAddress;
  // UI 상태 업데이트
  updateUIState(true);

  const walletBtn = document.querySelector('.btn-connect-wallet');
  if (walletBtn) {
    walletBtn.innerText = '지갑 새로고침';
    walletBtn.onclick = refreshWallet;
  }

  // 지갑 연결 직후 정보 동기화
  await updateWalletInfo();      // BNB, GPMF, 권한 등 한번에 업데이트
  await loadContractState();     // 컨트랙트 상태 갱신 
  await Promise.allSettled([checkTokenBalance(), checkWalletRole()]);

  // 🔥 보유 토큰 & 권한을 즉시 반영 (중복 호출이지만 UI 확실하게 반영됨)
  await checkTokenBalance();
  await checkWalletRole();
}

async function refreshWallet() {
  await connectWallet();
}

async function updateWalletInfo() {
  await Promise.all([checkBNBBalance(), checkTokenBalance(), checkWalletRole()]).catch(() => { });
}

async function checkBNBBalance() {
  try {
    const wei = await web3.eth.getBalance(WalletAddress);
    const bnb = web3.utils.fromWei(wei, 'ether');
    document.getElementById('walletBalance').innerText = `${parseFloat(bnb).toFixed(4)} BNB`;
  } catch (e) {
    document.getElementById('walletBalance').innerText = '잔액 확인 실패';
  }
}

async function checkTokenBalance() {
  try {
    const c = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
    const bal = await c.methods.balanceOf(WalletAddress).call();
    const formatted = ethers.utils.formatEther(bal);
    document.getElementById('tokenBalance').innerText = `${parseFloat(formatted).toFixed(2)} GPMF`;
  } catch (e) {
    document.getElementById('tokenBalance').innerText = '토큰 잔액 확인 실패';
  }
}

// ====== 권한 체크 ======
async function checkWalletRole() {
  try {
    const c = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
    const owner = await c.methods.owner().call();
    const isOwner = owner.toLowerCase() === WalletAddress.toLowerCase();
    
    const el = document.getElementById('walletRole');
    el.className = 'wallet-role';
    if (isOwner) { 
      el.innerText = 'OWNER (관리자)'; 
      el.classList.add('admin'); 
    } else { 
      el.innerText = '일반 사용자'; 
      el.classList.add('normal'); 
    }

    // Owner만 버튼 활성화
    updateOwnerControls(isOwner);

  } catch (e) {
    document.getElementById('walletRole').innerText = '권한 확인 실패';
    updateOwnerControls(false);
  }
}

function updateOwnerControls(isOwner) {
  // Owner 전용 버튼들 활성화/비활성화
  const ownerButtons = document.querySelectorAll('.owner-only');
  ownerButtons.forEach(btn => {
    btn.disabled = !isOwner;
    btn.title = isOwner ? '' : 'Owner 권한이 필요합니다.';
  });
}

// ====== Pause/Unpause ======
async function pauseToken() {
  await ensureConnected();
  try {
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.pause();
    const tx = await c.pause({ gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert('토큰 일시정지 완료');
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

async function unpauseToken() {
  await ensureConnected();
  try {
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.unpause();
    const tx = await c.unpause({ gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert('토큰 정상화 완료');
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

// ====== Lockup 관리 ======
async function setLockup() {
  await ensureConnected();
  try {
    const account = document.getElementById('lockupAccount').value.trim();
    const minutes = document.getElementById('lockupMinutes').value;
    const amount = document.getElementById('lockupAmount').value;
    
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    if (!isValidInteger(minutes, 1)) throw new Error('락업 시간은 1분 이상의 정수여야 합니다');
    if (!isValidAmount(amount, 0)) throw new Error('수량 오류');
    
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.setLockup(account, minutes, amountWei);
    const tx = await c.setLockup(account, minutes, amountWei, { gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert(`락업 설정 완료: ${amount} GPMF를 ${minutes}분 동안 락업`);
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

async function extendLockup() {
  await ensureConnected();
  try {
    const account = document.getElementById('extendAccount').value.trim();
    const addMinutes = document.getElementById('extendMinutes').value;
    
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    if (!isValidInteger(addMinutes, 1)) throw new Error('연장 시간은 1분 이상의 정수여야 합니다');
    
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.extendLockup(account, addMinutes);
    const tx = await c.extendLockup(account, addMinutes, { gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert(`락업 연장 완료: ${addMinutes}분 추가됨`);
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

async function decreaseLockAmount() {
  await ensureConnected();
  try {
    const account = document.getElementById('decreaseAccount').value.trim();
    const newAmount = document.getElementById('decreaseAmount').value;
    
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    if (!isValidAmount(newAmount, 0)) throw new Error('수량 오류');
    
    const amountWei = ethers.utils.parseEther(newAmount.toString());
    
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.decreaseLockAmount(account, amountWei);
    const tx = await c.decreaseLockAmount(account, amountWei, { gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert(`락업 수량 감소 완료\n새로운 락업 수량: ${newAmount} GPMF\n\n⚠️ 주의: 기존 수량에서 빼는 것이 아니라 새 수량으로 교체되었습니다!`);
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

async function releaseLockup() {
  await ensureConnected();
  try {
    const account = document.getElementById('releaseAccount').value.trim();
    const amount = document.getElementById('releaseAmount').value;
    
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    if (!isValidAmount(amount, 0)) throw new Error('수량 오류');
    
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.releaseLockup(account, amountWei);
    const tx = await c.releaseLockup(account, amountWei, { gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert(`락업 부분 해제 완료\n해제된 수량: ${amount} GPMF\n\n✅ 입력한 수량만큼 기존 락업에서 차감되었습니다!`);
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

async function clearExpiredLockup() {
  await ensureConnected();
  try {
    const account = document.getElementById('clearAccount').value.trim();
    
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.clearExpiredLockup(account);
    const tx = await c.clearExpiredLockup(account, { gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert(`만료된 락업 제거 완료\n\n컨트랙트 저장소에서 깔끔하게 정리되었습니다.\n이 작업은 필수가 아니며 가스비 절약을 위한 선택사항입니다.`);
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

// ====== Lockup 조회 ======
async function checkLockupInfo() {
  try {
    const account = document.getElementById('checkLockupAccount').value.trim();
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    
    const c = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
    const info = await c.methods.lockedInfo(account).call();
    
    const locked = ethers.utils.formatEther(info.locked);
    const remainingSec = Number(info.remainingSeconds);
    const expiration = Number(info.expiration);
    
    // 락업이 없거나 만료된 경우
    if (Number(locked) === 0 || remainingSec === 0) {
      document.getElementById('lockupInfoResult').innerText = '❌ 아직 락업 상태가 아닙니다.';
      document.getElementById('lockupInfoResult').style.borderColor = '#888';
      return;
    }
    
    // 만료 시간 계산 (정확한 한국 시간)
    const expirationDate = new Date(expiration * 1000);
    const now = new Date();
    
    // 남은 시간을 일/시/분/초로 변환
    const days = Math.floor(remainingSec / 86400);
    const hours = Math.floor((remainingSec % 86400) / 3600);
    const minutes = Math.floor((remainingSec % 3600) / 60);
    const seconds = remainingSec % 60;
    
    let timeStr = '';
    if (days > 0) timeStr += `${days}일 `;
    if (hours > 0) timeStr += `${hours}시간 `;
    if (minutes > 0) timeStr += `${minutes}분 `;
    timeStr += `${seconds}초`;
    
    document.getElementById('lockupInfoResult').innerText = 
      `✅ 락업 정보\n\n` +
      `🔒 락업 수량: ${locked} GPMF\n` +
      `⏱ 남은 시간: ${timeStr} (총 ${remainingSec.toLocaleString()}초)\n` +
      `📅 만료 일시: ${expirationDate.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })}\n` +
      `🌐 현재 시간: ${now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })}`;
    
    document.getElementById('lockupInfoResult').style.borderColor = '#00ffcc';
  } catch (e) {
    document.getElementById('lockupInfoResult').innerText = '조회 실패: ' + e.message;
    document.getElementById('lockupInfoResult').style.borderColor = '#ff6b6b';
  }
}

async function checkUnlockedBalance() {
  try {
    const account = document.getElementById('checkUnlockedAccount').value.trim();
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    
    const c = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
    const unlocked = await c.methods.unlockedBalanceOf(account).call();
    const total = await c.methods.balanceOf(account).call();
    const locked = await c.methods.lockedBalance(account).call();
    
    const unlockedFormatted = ethers.utils.formatEther(unlocked);
    const totalFormatted = ethers.utils.formatEther(total);
    const lockedFormatted = ethers.utils.formatEther(locked);
    
    document.getElementById('unlockedBalanceResult').innerText = 
      `✅ 잔액 정보\n\n` +
      `💰 전체 보유: ${totalFormatted} GPMF\n` +
      `🔒 락업 중: ${lockedFormatted} GPMF\n` +
      `✅ 사용 가능: ${unlockedFormatted} GPMF`;
    
    document.getElementById('unlockedBalanceResult').style.borderColor = '#00ffcc';
  } catch (e) {
    document.getElementById('unlockedBalanceResult').innerText = '조회 실패: ' + e.message;
    document.getElementById('unlockedBalanceResult').style.borderColor = '#ff6b6b';
  }
}

// ====== 토큰 전송 ======
async function transferToken() {
  await ensureConnected();
  try {
    const to = document.getElementById('transferTo').value.trim();
    const amount = document.getElementById('transferAmount').value;
    
    if (!isValidEthereumAddress(to)) throw new Error('주소 형식 오류');
    if (!isValidAmount(amount, 0)) throw new Error('수량 오류');
    
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.transfer(to, amountWei);
    const tx = await c.transfer(to, amountWei, { gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert(`전송 완료!\n받는 주소: ${to}\n전송 수량: ${amount} GPMF\n\n✅ 트랜잭션이 성공적으로 처리되었습니다.`);
    await updateWalletInfo();
  } catch (e) { alert(friendlyError(e)); }
}

// ====== 토큰 소각 ======
async function burnToken() {
  await ensureConnected();
  try {
    const amount = document.getElementById('burnAmount').value;
    
    if (!isValidAmount(amount, 0)) throw new Error('수량 오류');
    
    const amountWei = ethers.utils.parseEther(amount.toString());
    
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const gas = await c.estimateGas.burn(amountWei);
    const tx = await c.burn(amountWei, { gasLimit: gas.mul(120).div(100) });
    await tx.wait();
    alert(`소각 완료!\n소각된 수량: ${amount} GPMF\n\n⚠️ 이 토큰은 영구적으로 제거되었으며 복구할 수 없습니다.\n총 공급량도 함께 감소했습니다.`);
    await updateWalletInfo();
    await loadContractState();
  } catch (e) { alert(friendlyError(e)); }
}

// ====== 토큰 정보 조회 ======
async function checkBalance() {
  try {
    const account = document.getElementById('checkBalanceAccount').value.trim();
    if (!isValidEthereumAddress(account)) throw new Error('주소 형식 오류');
    
    const c = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
    const bal = await c.methods.balanceOf(account).call();
    const formatted = ethers.utils.formatEther(bal);
    
    document.getElementById('balanceResult').innerText = 
      `💰 전체 잔액: ${formatted} GPMF\n\n` +
      `💡 이 중 일부는 락업되어 있을 수 있습니다.\n` +
      `   사용 가능 잔액은 "사용 가능 잔액 확인"에서 조회하세요.`;
    
    document.getElementById('balanceResult').style.borderColor = '#00ffcc';
  } catch (e) {
    document.getElementById('balanceResult').innerText = '조회 실패: ' + e.message;
    document.getElementById('balanceResult').style.borderColor = '#ff6b6b';
  }
}

// ====== 컨트랙트 상태 조회 ======
async function loadContractState() {
  // 지갑이 연결되지 않은 상태면 스킵
  if (!WalletAddress || !ethersSigner) {
    return;
  }

  try {
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, ethersSigner);
    const wc = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

    const [
      name, symbol, decimals, totalSupply, paused, owner
    ] = await Promise.all([
      c.name(),
      c.symbol(),
      c.decimals(),
      wc.methods.totalSupply().call(),
      c.paused(),
      c.owner()
    ]);

    // DOM 반영
    setText('st_name', name);
    setText('st_symbol', symbol);
    setText('st_decimals', decimals.toString());
    setText('st_totalSupply', ethers.utils.formatEther(totalSupply) + ' GPMF');
    setText('st_paused', paused ? '일시정지 상태' : '정상');
    setText('st_owner', owner);

  } catch (e) {
    console.error('컨트랙트 상태 조회 오류:', e);

    const errorMessage = e?.message || String(e);

    // 네트워크 불일치 감지
    if (/Returned values aren't valid|did it run Out of Gas|not using the correct ABI|requesting data from a block number that does not exist|node which is not fully synced/i.test(errorMessage)) {
      alert(`BSC Mainnet에서 컨트랙트를 찾을 수 없습니다.\n\nsmartcontract.js에서 컨트랙트 주소를 확인해주세요.\n\n현재 주소: ${CONTRACT_ADDRESS}`);
    } else {
      alert(friendlyError(e));
    }
  }
}

async function onNetworkChange(newNetworkId) {
  Network = parseInt(newNetworkId, 10);

  // 네트워크 전환
  const switched = await checkAndSwitchNetwork();
  if (!switched) return;

  // 지갑이 연결되어 있지 않다면 자동 연결 시도
  if (!WalletAddress) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        WalletAddress = accounts[0];
        document.getElementById('walletAddress').innerText = WalletAddress;
        const walletBtn = document.querySelector('.btn-connect-wallet');
        if (walletBtn) {
          walletBtn.innerText = '지갑 새로고침';
          walletBtn.onclick = refreshWallet;
        }
      }
    } catch (connectError) {
      // 사용자가 지갑 연결을 거부한 경우 - 조용히 넘어감
      console.log('지갑 연결 취소됨');
      return;
    }
  }

  // 지갑이 연결된 상태에서만 업데이트 및 컨트랙트 테스트
  if (WalletAddress) {
    await updateWalletInfo();
    await loadContractState();

    // 컨트랙트 연결 테스트 (연결 후에만)
    await testContractConnection();
  }
}

// 안전한 text 주입 헬퍼
function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.innerText = v;
}

// ====== 초기 DOM 세팅 ======
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('networkSelect');
  if (sel) {
    sel.value = Network.toString();
    sel.addEventListener('change', async (e) => {
      await onNetworkChange(e.target.value);
    });
  }

  // 기본 상태
  updateUIState(false);
});