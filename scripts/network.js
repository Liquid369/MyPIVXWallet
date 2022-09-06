'use strict';

function networkError() {
    if (disableNetwork()) {
        createAlert('warning',
                    '<b>Failed to synchronize!</b> Please try again later.' +
                    '<br>You can attempt re-connect via the Settings.');
    }
}

if (networkEnabled) {
  var getBlockCount = function() {
    var request = new XMLHttpRequest();
    request.open('GET', "https://zkbitcoin.com/api/v2/api", true);
    request.onerror = networkError;
    request.onload = function () {
      const data = JSON.parse(this.response);
      // If the block count has changed, refresh all of our data!
      domBalanceReload.className = domBalanceReload.className.replace(/ playAnim/g, "");
      domBalanceReloadStaking.className = domBalanceReloadStaking.className.replace(/ playAnim/g, "");
      if (data.backend.blocks > cachedBlockCount) {
        console.log("New block detected! " + cachedBlockCount + " --> " + data.backend.blocks);
        if (publicKeyForNetwork)
          getUTXOs();
      }
      cachedBlockCount = data.backend.blocks;
    }
    request.send();
  }

  var arrUTXOsToValidate = [];
  var acceptUTXO = () => {
    // Cancel if the queue is empty: no wasting precious bandwidth & CPU cycles!
    if (!arrUTXOsToValidate.length) return;

    const request = new XMLHttpRequest();
    request.open('GET', "https://zkbitcoin.com/api/v2/tx-specific/" + arrUTXOsToValidate[0].txid, true);
    request.onerror = networkError;

    request.onload = function() {
      const data = JSON.parse(this.response);

      for (const cVout of data.vout) {
        // TODO: Determine if this is useful or not? I don't remember what this is, or why I added it.
        if (cVout.spent) continue;

        // Search for our address
        if (!cVout.scriptPubKey.addresses) continue;
        if (!cVout.scriptPubKey.addresses.includes(publicKeyForNetwork)) continue;

        // Convert to MPW format
        const cUTXO = {
          'id': data.txid,
          'vout': cVout.n,
          'sats': cVout.value * COIN,
          'script': cVout.scriptPubKey.hex
        }

        // Determine the UTXO type, and use it accordingly
        if (cVout.scriptPubKey.type === 'pubkeyhash') {
          // P2PKH type (Pay-To-Pub-Key-Hash)
          cachedUTXOs.push(cUTXO);
        } else
        if (cVout.scriptPubKey.type === 'coldstake') {
          // Cold Stake type
          arrDelegatedUTXOs.push(cUTXO);
        }
      }

      // Shift the queue and update the UI
      getBalance(true);
      getStakingBalance(true);
      
      // Loop validation until queue is empty
      arrUTXOsToValidate.shift();
      if (arrUTXOsToValidate.length) acceptUTXO();
    }
    request.send();
  }

  var getUTXOs = () => {
    // Don't fetch UTXOs if we're already scanning for them!
    if (arrUTXOsToValidate.length) return;

    const request = new XMLHttpRequest()
    request.open('GET', "https://zkbitcoin.com/api/v2/utxo/" + publicKeyForNetwork, true);
    request.onerror = networkError;
    request.onload = function() {
      arrUTXOsToValidate = JSON.parse(this.response);
      // Clear our UTXOs and begin accepting refreshed ones (TODO: build an efficient 'set merge' algo)
      cachedUTXOs = []; arrDelegatedUTXOs = [];
      acceptUTXO();
    }
    request.send();
  }

var sendTransaction = function(hex, msg = '') {
    const request = new XMLHttpRequest();
    request.open('GET', 'https://zkbitcoin.com/api/v2/sendtx/' + hex, true);
    request.onerror = networkError;
    request.onreadystatechange = function () {
        if (!this.response || (!this.status === 200 && !this.status === 400)) return;
        if (this.readyState !== 4) return;
        const data = JSON.parse(this.response);
        if (data.result && data.result.length === 64) {
            console.log('Transaction sent! ' + data.result);
            if (domAddress1s.value !== donationAddress)
                domTxOutput.innerHTML = ('<h4 style="color:green; font-family:mono !important;">' + data.result + '</h4>');
            else
                domTxOutput.innerHTML = ('<h4 style="color:green">Thank you for supporting MyPIVXWallet! 💜💜💜<br><span style="font-family:mono !important">' + data.result + '</span></h4>');
            domSimpleTXs.style.display = 'none';
            domAddress1s.value = '';
            domValue1s.innerHTML = '';
            createAlert('success', msg || 'Transaction sent!', msg ? (1250 + (msg.length * 50)) : 1500);
        } else {
            console.log('Error sending transaction: ' + data.result);
            createAlert('warning', 'Transaction Failed!', 1250);
            // Attempt to parse and prettify JSON (if any), otherwise, display the raw output.
            let strError = data.error;
            try {
                strError = JSON.stringify(JSON.parse(data), null, 4);
                console.log('parsed');
            } catch(e){console.log('no parse!'); console.log(e);}
            domTxOutput.innerHTML = '<h4 style="color:red;font-family:mono !important;"><pre style="color: inherit;">' + strError + "</pre></h4>";
        }
    }
    request.send();
}

  var calculatefee = function (bytes) {
    // TEMPORARY: Hardcoded fee per-byte
    return (bytes * 50) / COIN; // 50 sat/byte
  }
}