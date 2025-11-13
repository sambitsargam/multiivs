//! # IVS Aggregator Pallet
//!
//! Orchestrates multi-disease IVS computation with threshold decryption
//!
//! ## Overview
//!
//! This pallet runs on the aggregator parachain and:
//! - Stores combined IVS scores (encrypted) across multiple diseases
//! - Manages recompute requests that trigger off-chain workers
//! - Enforces threshold decryption policies
//! - Maintains MHE committee member registry
//! - Tracks computation history and audit logs

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use sp_std::vec::Vec;

    /// Committee member for threshold cryptography
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct CommitteeMember<AccountId> {
        /// Member's account ID
        pub account: AccountId,
        /// Member identifier (e.g., "HealthDept", "Hospital-A")
        pub name: BoundedVec<u8, ConstU32<64>>,
        /// Public key share identifier
        pub key_share_id: BoundedVec<u8, ConstU32<128>>,
        /// Is member active?
        pub is_active: bool,
        /// Joined at block number
        pub joined_at: u64,
    }

    /// Aggregated IVS record (encrypted, cross-disease)
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct AggregatedIVS {
        /// IPFS CID pointing to encrypted aggregated IVS
        pub cid: BoundedVec<u8, ConstU32<128>>,
        /// List of disease IDs included in aggregation
        pub disease_ids: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<16>>,
        /// Computation timestamp
        pub computed_at: u64,
        /// Computation parameters (JSON metadata)
        pub parameters: BoundedVec<u8, ConstU32<256>>,
    }

    /// Recompute request
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct RecomputeRequest {
        /// Request ID
        pub request_id: u64,
        /// Requested by
        pub requester: BoundedVec<u8, ConstU32<128>>,
        /// Target user (None = all users)
        pub target_user: Option<BoundedVec<u8, ConstU32<128>>>,
        /// Disease IDs to include
        pub disease_ids: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<16>>,
        /// Request timestamp
        pub requested_at: u64,
        /// Status: Pending, InProgress, Completed, Failed
        pub status: RequestStatus,
    }

    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum RequestStatus {
        Pending,
        InProgress,
        Completed,
        Failed,
    }

    /// Threshold decryption policy
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct DecryptionPolicy<AccountId> {
        /// Authorized requesters
        pub authorized_accounts: BoundedVec<AccountId, ConstU32<16>>,
        /// Minimum shares required
        pub threshold: u32,
        /// Total shares
        pub total_shares: u32,
        /// Policy expiration block
        pub expires_at: Option<u64>,
        /// Audit log enabled
        pub audit_enabled: bool,
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// Maximum number of committee members
        #[pallet::constant]
        type MaxCommitteeSize: Get<u32>;
        
        /// Maximum diseases in aggregation
        #[pallet::constant]
        type MaxDiseases: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// MHE Committee members
    #[pallet::storage]
    #[pallet::getter(fn committee_member)]
    pub type Committee<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        CommitteeMember<T::AccountId>,
        OptionQuery,
    >;

    /// Aggregated IVS scores (user → encrypted combined IVS)
    #[pallet::storage]
    #[pallet::getter(fn aggregated_ivs)]
    pub type AggregatedIVSScores<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        AggregatedIVS,
        OptionQuery,
    >;

    /// Recompute requests queue
    #[pallet::storage]
    #[pallet::getter(fn recompute_request)]
    pub type RecomputeRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // request_id
        RecomputeRequest,
        OptionQuery,
    >;

    /// Next request ID
    #[pallet::storage]
    #[pallet::getter(fn next_request_id)]
    pub type NextRequestId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// Decryption policy
    #[pallet::storage]
    #[pallet::getter(fn decryption_policy)]
    pub type CurrentDecryptionPolicy<T: Config> = StorageValue<
        _,
        DecryptionPolicy<T::AccountId>,
        OptionQuery,
    >;

    /// Joint public key CID
    #[pallet::storage]
    #[pallet::getter(fn joint_public_key)]
    pub type JointPublicKey<T: Config> = StorageValue<_, BoundedVec<u8, ConstU32<128>>, ValueQuery>;

    /// Committee size
    #[pallet::storage]
    #[pallet::getter(fn committee_size)]
    pub type CommitteeSize<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Committee member added
        CommitteeMemberAdded { account: T::AccountId, name: Vec<u8> },
        /// Recompute requested
        RecomputeRequested { request_id: u64, requester: Vec<u8>, diseases: Vec<Vec<u8>> },
        /// Recompute completed
        RecomputeCompleted { request_id: u64 },
        /// Aggregated IVS stored
        AggregatedIVSStored { user: T::AccountId, cid: Vec<u8>, diseases: Vec<Vec<u8>> },
        /// Decryption policy updated
        DecryptionPolicyUpdated { threshold: u32, total_shares: u32 },
        /// Joint public key updated
        JointPublicKeyUpdated { cid: Vec<u8> },
        /// Decryption request authorized
        DecryptionAuthorized { requester: T::AccountId, user: T::AccountId },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Committee member already exists
        CommitteeMemberExists,
        /// Committee member not found
        CommitteeMemberNotFound,
        /// Committee is full
        CommitteeFull,
        /// Request not found
        RequestNotFound,
        /// Not authorized
        NotAuthorized,
        /// Invalid parameters
        InvalidParameters,
        /// Too many diseases
        TooManyDiseases,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Add committee member
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn add_committee_member(
            origin: OriginFor<T>,
            account: T::AccountId,
            name: Vec<u8>,
            key_share_id: Vec<u8>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            ensure!(!Committee::<T>::contains_key(&account), Error::<T>::CommitteeMemberExists);
            
            let size = CommitteeSize::<T>::get();
            ensure!(size < T::MaxCommitteeSize::get(), Error::<T>::CommitteeFull);

            let name_bounded: BoundedVec<u8, ConstU32<64>> = 
                name.clone().try_into().map_err(|_| Error::<T>::InvalidParameters)?;
            let key_bounded: BoundedVec<u8, ConstU32<128>> = 
                key_share_id.try_into().map_err(|_| Error::<T>::InvalidParameters)?;

            let member = CommitteeMember {
                account: account.clone(),
                name: name_bounded,
                key_share_id: key_bounded,
                is_active: true,
                joined_at: Self::current_timestamp(),
            };

            Committee::<T>::insert(&account, member);
            CommitteeSize::<T>::mutate(|s| *s = s.saturating_add(1));

            Self::deposit_event(Event::CommitteeMemberAdded { account, name });
            Ok(())
        }

        /// Request IVS recomputation
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn request_recompute(
            origin: OriginFor<T>,
            disease_ids: Vec<Vec<u8>>,
            target_user: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let request_id = NextRequestId::<T>::get();
            NextRequestId::<T>::mutate(|id| *id = id.saturating_add(1));

            let requester: BoundedVec<u8, ConstU32<128>> = 
                format!("{:?}", who).as_bytes().to_vec()
                    .try_into().map_err(|_| Error::<T>::InvalidParameters)?;

            let target_bounded = target_user.map(|u| {
                u.try_into().map_err(|_| Error::<T>::InvalidParameters)
            }).transpose()?;

            let diseases_bounded: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<16>> = 
                disease_ids.iter()
                    .map(|d| d.clone().try_into().map_err(|_| Error::<T>::TooManyDiseases))
                    .collect::<Result<Vec<_>, _>>()?
                    .try_into().map_err(|_| Error::<T>::TooManyDiseases)?;

            let request = RecomputeRequest {
                request_id,
                requester: requester.clone(),
                target_user: target_bounded,
                disease_ids: diseases_bounded.clone(),
                requested_at: Self::current_timestamp(),
                status: RequestStatus::Pending,
            };

            RecomputeRequests::<T>::insert(request_id, request);

            Self::deposit_event(Event::RecomputeRequested {
                request_id,
                requester: requester.to_vec(),
                diseases: disease_ids,
            });
            Ok(())
        }

        /// Store aggregated IVS result (called by compute network)
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn store_aggregated_ivs(
            origin: OriginFor<T>,
            user: T::AccountId,
            cid: Vec<u8>,
            disease_ids: Vec<Vec<u8>>,
            parameters: Vec<u8>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            let cid_bounded: BoundedVec<u8, ConstU32<128>> = 
                cid.clone().try_into().map_err(|_| Error::<T>::InvalidParameters)?;

            let diseases_bounded: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<16>> = 
                disease_ids.iter()
                    .map(|d| d.clone().try_into().map_err(|_| Error::<T>::TooManyDiseases))
                    .collect::<Result<Vec<_>, _>>()?
                    .try_into().map_err(|_| Error::<T>::TooManyDiseases)?;

            let params_bounded: BoundedVec<u8, ConstU32<256>> = 
                parameters.try_into().map_err(|_| Error::<T>::InvalidParameters)?;

            let aggregated = AggregatedIVS {
                cid: cid_bounded,
                disease_ids: diseases_bounded.clone(),
                computed_at: Self::current_timestamp(),
                parameters: params_bounded,
            };

            AggregatedIVSScores::<T>::insert(&user, aggregated);

            Self::deposit_event(Event::AggregatedIVSStored {
                user,
                cid,
                diseases: disease_ids,
            });
            Ok(())
        }

        /// Update decryption policy
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn set_decryption_policy(
            origin: OriginFor<T>,
            authorized_accounts: Vec<T::AccountId>,
            threshold: u32,
            total_shares: u32,
            expires_at: Option<u64>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            let accounts_bounded: BoundedVec<T::AccountId, ConstU32<16>> = 
                authorized_accounts.try_into().map_err(|_| Error::<T>::InvalidParameters)?;

            let policy = DecryptionPolicy {
                authorized_accounts: accounts_bounded,
                threshold,
                total_shares,
                expires_at,
                audit_enabled: true,
            };

            CurrentDecryptionPolicy::<T>::put(policy);

            Self::deposit_event(Event::DecryptionPolicyUpdated {
                threshold,
                total_shares,
            });
            Ok(())
        }

        /// Update joint public key
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn update_joint_public_key(
            origin: OriginFor<T>,
            cid: Vec<u8>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            let cid_bounded: BoundedVec<u8, ConstU32<128>> = 
                cid.clone().try_into().map_err(|_| Error::<T>::InvalidParameters)?;

            JointPublicKey::<T>::put(cid_bounded);

            Self::deposit_event(Event::JointPublicKeyUpdated { cid });
            Ok(())
        }

        /// Mark recompute request as completed
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn complete_recompute_request(
            origin: OriginFor<T>,
            request_id: u64,
        ) -> DispatchResult {
            ensure_root(origin)?;

            RecomputeRequests::<T>::try_mutate(request_id, |request_opt| {
                let request = request_opt.as_mut().ok_or(Error::<T>::RequestNotFound)?;
                request.status = RequestStatus::Completed;
                Ok::<(), Error<T>>(())
            })?;

            Self::deposit_event(Event::RecomputeCompleted { request_id });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Get current timestamp
        fn current_timestamp() -> u64 {
            <frame_system::Pallet<T>>::block_number().saturated_into::<u64>()
        }

        /// Check if requester can decrypt for a user
        pub fn can_decrypt(requester: &T::AccountId, _user: &T::AccountId) -> bool {
            if let Some(policy) = CurrentDecryptionPolicy::<T>::get() {
                // Check if policy expired
                if let Some(expiry) = policy.expires_at {
                    if Self::current_timestamp() > expiry {
                        return false;
                    }
                }
                
                // Check if requester is authorized
                policy.authorized_accounts.contains(requester)
            } else {
                false
            }
        }

        /// Get all committee members
        pub fn get_committee_members() -> Vec<T::AccountId> {
            Committee::<T>::iter_keys().collect()
        }

        /// Get pending recompute requests
        pub fn get_pending_requests() -> Vec<u64> {
            RecomputeRequests::<T>::iter()
                .filter(|(_, req)| matches!(req.status, RequestStatus::Pending))
                .map(|(id, _)| id)
                .collect()
        }
    }
}
