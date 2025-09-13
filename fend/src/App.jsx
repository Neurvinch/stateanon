import { useState, useEffect, Component } from 'react';
import { LogInWithAnonAadhaar, AnonAadhaarProof } from '@anon-aadhaar/react';
import { parseProofForVerifier } from '@anon-aadhaar/core';
import MerkleTree from 'merkletreejs';
import keccak256 from 'keccak256';
import { ethers } from 'ethers';

// Error Boundary Component
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center p-4">
          <h2 className="text-red-600">Something went wrong!</h2>
          <p>{this.state.error?.message || 'Unknown error'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-md"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ABI for CollegeVoting contract
const COLLEGE_VOTING_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'voteOption', type: 'uint256' },
      { internalType: 'uint[2]', name: 'a', type: 'uint256[2]' },
      { internalType: 'uint[2][2]', name: 'b', type: 'uint256[2][2]' },
      { internalType: 'uint[2]', name: 'c', type: 'uint256[2]' },
      { internalType: 'uint[30]', name: 'input', type: 'uint256[30]' },
      { internalType: 'bytes32[]', name: 'merkleProof', type: 'bytes32[]' },
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'comment', type: 'string' }],
    name: 'addComment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

function App() {
  return (
    <ErrorBoundary>
      <AnonAadhaarComponent />
    </ErrorBoundary>
  );
}

function AnonAadhaarComponent() {
  const [profile, setProfile] = useState(null);
  const [latestProof, setLatestProof] = useState(null);
  const [voteOption, setVoteOption] = useState(1);
  const [comment, setComment] = useState('');
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [voteTxHash, setVoteTxHash] = useState(null);
  const [commentTxHash, setCommentTxHash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const contractAddress = "0x95c1AE6Ad8F7821F257C5E618B913C9be3077a3B";

  // Sample pincode data
  const statePincodes = {
    Maharashtra: ['400001', '400002', '411001', '411002'],
    Karnataka: ['560001', '560002', '560003'],
    TamilNadu: ['600001', '600002', '600003'],
  };

  useEffect(() => {
    if (!contractAddress) {
      setError('Missing VITE_COLLEGE_VOTING_ADDRESS in .env file!');
      console.error('Missing VITE_COLLEGE_VOTING_ADDRESS in .env file!');
      return;
    }

    if (window.ethereum) {
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(ethProvider);

      const init = async () => {
        try {
          const accounts = await ethProvider.listAccounts();
          console.log('Initial accounts:', accounts);
          if (accounts.length > 0 && typeof accounts[0] === 'string') {
            setAccount(accounts[0]);
            const ethSigner = await ethProvider.getSigner();
            setSigner(ethSigner);
            const ethContract = new ethers.Contract(contractAddress, COLLEGE_VOTING_ABI, ethSigner);
            setContract(ethContract);
            setIsConnected(true);
            console.log('Connected account:', accounts[0]);
          } else {
            console.log('No accounts connected or invalid account');
            setIsConnected(false);
            setAccount(null);
          }
        } catch (err) {
          setError('Failed to initialize wallet: ' + err.message);
          console.error('Failed to connect:', err);
        }
      };

      init();

      window.ethereum.on('accountsChanged', (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0 || !accounts[0]) {
          setIsConnected(false);
          setAccount(null);
          setSigner(null);
          setContract(null);
          console.log('Disconnected: No accounts');
        } else if (typeof accounts[0] === 'string') {
          setAccount(accounts[0]);
          if (contractAddress) {
            ethProvider.getSigner().then((ethSigner) => {
              setSigner(ethSigner);
              setContract(new ethers.Contract(contractAddress, COLLEGE_VOTING_ABI, ethSigner));
              setIsConnected(true);
              console.log('Reconnected account:', accounts[0]);
            }).catch((err) => {
              setError('Failed to re-init signer: ' + err.message);
              console.error('Re-init signer failed:', err);
            });
          }
        }
      });
    } else {
      setError('No Ethereum provider (e.g., MetaMask) detected');
      console.log('No Ethereum provider detected');
    }
  }, [contractAddress]);

  const connectWallet = async () => {
    if (!contractAddress) {
      setError('Missing VITE_COLLEGE_VOTING_ADDRESS in .env file!');
      alert('Error: Set VITE_COLLEGE_VOTING_ADDRESS in .env with your deployed contract address.');
      return;
    }

    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log('Connect wallet accounts:', accounts);
        if (accounts.length === 0 || !accounts[0]) {
          setError('No accounts authorized');
          alert('Please authorize an account in MetaMask');
          return;
        }
        if (typeof accounts[0] === 'string') {
          setAccount(accounts[0]);
          const ethSigner = await provider.getSigner();
          setSigner(ethSigner);
          const ethContract = new ethers.Contract(contractAddress, COLLEGE_VOTING_ABI, ethSigner);
          setContract(ethContract);
          setIsConnected(true);
          setError(null);
          console.log('Connected via button:', accounts[0]);
        } else {
          setError('Invalid account format');
          alert('Invalid account format');
        }
      } catch (error) {
        setError('Connection failed: ' + error.message);
        console.error('Connection failed:', error);
        alert('Connection failed: ' + error.message);
      }
    }
  };

  const handleProofSuccess = (proof, revealedFields) => {
    setLatestProof(proof);
    const newProfile = {
      ...revealedFields,
      aadhaarVerified: true,
      nullifierHash: proof.nullifierHash,
      name: '',
      collegeYear: '',
      class: '',
    };
    setProfile(newProfile);
    console.log('Proof generated:', proof);
  };

  const getMerkleProof = (state, pincode) => {
    const pincodes = statePincodes[state] || [];
    if (!pincodes.includes(pincode)) {
      console.error('Pincode not in state list');
      return [];
    }
    const leaves = pincodes.map((code) => keccak256(code));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const leaf = keccak256(pincode);
    return tree.getProof(leaf);
  };

  const handleVote = async () => {
    if (!contract || !latestProof || !profile) {
      alert('Please verify Aadhaar first and connect wallet');
      return;
    }
    setLoading(true);
    try {
      const merkleProof = getMerkleProof(profile.state, profile.pincode);
      const [a, b, c, input] = parseProofForVerifier(latestProof);
      const tx = await contract.vote(voteOption, a, b, c, input, merkleProof.map(p => p.data));
      const receipt = await tx.wait();
      setVoteTxHash(receipt.hash);
      console.log('Vote submitted:', receipt.hash);
    } catch (error) {
      console.error('Vote failed:', error);
      alert('Vote failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleComment = async () => {
    if (!contract || !comment.trim()) {
      alert('Please connect wallet and enter a comment');
      return;
    }
    setLoading(true);
    try {
      const tx = await contract.addComment(comment);
      const receipt = await tx.wait();
      setCommentTxHash(receipt.hash);
      setComment('');
      console.log('Comment added:', receipt.hash);
    } catch (error) {
      console.error('Comment failed:', error);
      alert('Comment failed: ' + error.message);
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
          {error.includes('VITE_COLLEGE_VOTING_ADDRESS') ? (
            <p className="mt-2 text-gray-600">Add VITE_COLLEGE_VOTING_ADDRESS to .env and restart server.</p>
          ) : (
            <button
              onClick={connectWallet}
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md"
            >
              Try Connecting Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!window.ethereum) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Install MetaMask to Start</h1>
        </div>
      </div>
    );
  }

  if (!isConnected || !account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Wallet to Start</h1>
          <button
            onClick={connectWallet}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md"
          >
            Connect MetaMask
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center px-4">
      <main className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center gap-6">
        <h1 className="font-extrabold text-2xl text-gray-900 text-center">
          🔐 Anon Aadhaar College Voting
        </h1>
        <p className="text-gray-600 text-center">
          Prove identity anonymously & vote/comment on-chain.
        </p>
        {account && typeof account === 'string' && (
          <p className="text-sm text-gray-500">
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </p>
        )}

        {!profile?.aadhaarVerified ? (
          <LogInWithAnonAadhaar
            fieldsToReveal={["revealGender", "revealAgeAbove18", "revealState", "revealPinCode"]}
            nullifierSeed={1234}
            onSuccess={handleProofSuccess}
          />
        ) : (
          <div className="w-full bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-700 font-semibold text-center">✅ Aadhaar Verified</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Pincode</label>
                <input type="text" disabled value={profile.pincode} className="w-full border border-gray-300 rounded-md p-2 bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input type="text" disabled value={profile.state} className="w-full border border-gray-300 rounded-md p-2 bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Age</label>
                <input type="text" disabled value={profile.ageAbove18 ? "18+" : "Under 18"} className="w-full border border-gray-300 rounded-md p-2 bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">College Year</label>
                <input
                  type="text"
                  value={profile.collegeYear}
                  onChange={(e) => setProfile({ ...profile, collegeYear: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Class</label>
                <input
                  type="text"
                  value={profile.class}
                  onChange={(e) => setProfile({ ...profile, class: e.target.value })}
                  className="w-full border border-gray-300 rounded-md p-2"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3 break-words">
              <span className="font-semibold">Nullifier Hash:</span> {profile.nullifierHash || "—"}
            </p>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Cast Vote on Blockchain</h3>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vote Option (e.g., 1=Yes)</label>
              <input
                type="number"
                value={voteOption}
                onChange={(e) => setVoteOption(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md p-2 mb-3"
                min="1"
              />
              <button
                onClick={handleVote}
                disabled={loading}
                className="w-full bg-indigo-600 text-white rounded-md p-2 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Vote'}
              </button>
              {voteTxHash && <p className="text-green-600 text-sm mt-2">✅ Vote Submitted! Tx: {voteTxHash}</p>}
            </div>

            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">Add Comment</h3>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Enter your comment..."
                className="w-full border border-gray-300 rounded-md p-2 mb-3"
                rows={3}
              />
              <button
                onClick={handleComment}
                disabled={loading || !comment.trim()}
                className="w-full bg-yellow-600 text-white rounded-md p-2 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Comment'}
              </button>
              {commentTxHash && <p className="text-green-600 text-sm mt-2">✅ Comment Added! Tx: {commentTxHash}</p>}
            </div>
          </div>
        )}

        {latestProof && (
          <div className="mt-4 text-left w-full">
            <p className="text-xs text-gray-500 mb-1">Raw Proof (debug):</p>
            <div className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-xs font-mono text-gray-800 max-h-48">
              <AnonAadhaarProof code={JSON.stringify(latestProof, null, 2)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;