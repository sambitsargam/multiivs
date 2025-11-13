//! # Disease Tracker Pallet
//!
//! A FRAME pallet for tracking disease-specific user data with encrypted health status.
//!
//! ## Overview
//!
//! This pallet stores:
//! - User profile information (name, metadata)
//! - Contact graphs (who interacted with whom)
//! - Encrypted disease status (IPFS CID pointing to CKKS ciphertext)
//! - Disease-specific IVS scores (encrypted, as IPFS CID)
//! - Timestamps and disease identifiers
//!
//! Each parachain runs an instance of this pallet for a specific disease.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use sp_std::vec::Vec;

    /// User profile information
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct UserProfile {
        /// User's display name or identifier
        pub name: BoundedVec<u8, ConstU32<64>>,
        /// Optional metadata (JSON, additional info)
        pub metadata: BoundedVec<u8, ConstU32<256>>,
        /// Registration timestamp
        pub registered_at: u64,
        /// Is user active?
        pub is_active: bool,
    }

    /// Encrypted health status record
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct EncryptedHealthStatus {
        /// IPFS CID pointing to encrypted health data (CKKS ciphertext)
        pub cid: BoundedVec<u8, ConstU32<128>>,
        /// Disease identifier (e.g., "COVID-19", "Influenza")
        pub disease_id: BoundedVec<u8, ConstU32<64>>,
        /// Timestamp when encrypted data was uploaded
        pub uploaded_at: u64,
        /// Encryption scheme version (for future upgrades)
        pub encryption_version: u32,
        /// Joint public key identifier used for encryption
        pub public_key_id: BoundedVec<u8, ConstU32<64>>,
    }

    /// Encrypted IVS score record
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct EncryptedIVS {
        /// IPFS CID pointing to encrypted IVS score
        pub cid: BoundedVec<u8, ConstU32<128>>,
        /// Timestamp when IVS was computed
        pub computed_at: u64,
        /// Computation parameters (e.g., Dmax value)
        pub parameters: BoundedVec<u8, ConstU32<128>>,
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// Maximum number of contacts per user
        #[pallet::constant]
        type MaxContacts: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// User profiles indexed by AccountId
    #[pallet::storage]
    #[pallet::getter(fn user_profile)]
    pub type UserProfiles<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        UserProfile,
        OptionQuery,
    >;

    /// Contact graph: user → list of contact AccountIds
    #[pallet::storage]
    #[pallet::getter(fn contacts)]
    pub type Contacts<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<T::AccountId, T::MaxContacts>,
        ValueQuery,
    >;

    /// Encrypted health status for each user
    #[pallet::storage]
    #[pallet::getter(fn encrypted_health)]
    pub type EncryptedHealthStatuses<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        EncryptedHealthStatus,
        OptionQuery,
    >;

    /// Encrypted IVS scores for each user
    #[pallet::storage]
    #[pallet::getter(fn encrypted_ivs)]
    pub type EncryptedIVSScores<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        EncryptedIVS,
        OptionQuery,
    >;

    /// Disease identifier for this parachain instance
    #[pallet::storage]
    #[pallet::getter(fn disease_id)]
    pub type DiseaseId<T: Config> = StorageValue<_, BoundedVec<u8, ConstU32<64>>, ValueQuery>;

    /// Total registered users
    #[pallet::storage]
    #[pallet::getter(fn user_count)]
    pub type UserCount<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// Current joint public key identifier for encryption
    #[pallet::storage]
    #[pallet::getter(fn current_public_key)]
    pub type CurrentPublicKey<T: Config> = StorageValue<_, BoundedVec<u8, ConstU32<128>>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// User registered with profile
        UserRegistered { who: T::AccountId, name: Vec<u8> },
        /// Contact added
        ContactAdded { user: T::AccountId, contact: T::AccountId },
        /// Encrypted health status uploaded
        HealthStatusUploaded { who: T::AccountId, cid: Vec<u8>, disease_id: Vec<u8> },
        /// Encrypted IVS computed and stored
        IVSComputed { who: T::AccountId, cid: Vec<u8>, computed_at: u64 },
        /// Disease ID set for this parachain
        DiseaseIdSet { disease_id: Vec<u8> },
        /// Public key updated
        PublicKeyUpdated { key_id: Vec<u8> },
        /// User profile updated
        UserProfileUpdated { who: T::AccountId },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// User already registered
        UserAlreadyExists,
        /// User not found
        UserNotFound,
        /// Contact list is full
        TooManyContacts,
        /// Contact already exists
        ContactAlreadyExists,
        /// Invalid CID format
        InvalidCID,
        /// Invalid disease ID
        InvalidDiseaseId,
        /// Not authorized
        NotAuthorized,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Register a new user with profile information
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn register_user(
            origin: OriginFor<T>,
            name: Vec<u8>,
            metadata: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(!UserProfiles::<T>::contains_key(&who), Error::<T>::UserAlreadyExists);

            let name_bounded: BoundedVec<u8, ConstU32<64>> = 
                name.clone().try_into().map_err(|_| Error::<T>::InvalidDiseaseId)?;
            let metadata_bounded: BoundedVec<u8, ConstU32<256>> = 
                metadata.try_into().map_err(|_| Error::<T>::InvalidDiseaseId)?;

            let profile = UserProfile {
                name: name_bounded,
                metadata: metadata_bounded,
                registered_at: Self::current_timestamp(),
                is_active: true,
            };

            UserProfiles::<T>::insert(&who, profile);
            UserCount::<T>::mutate(|count| *count = count.saturating_add(1));

            Self::deposit_event(Event::UserRegistered { who, name });
            Ok(())
        }

        /// Add a contact to user's contact list
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn add_contact(
            origin: OriginFor<T>,
            contact: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(UserProfiles::<T>::contains_key(&who), Error::<T>::UserNotFound);

            Contacts::<T>::try_mutate(&who, |contacts| {
                ensure!(!contacts.contains(&contact), Error::<T>::ContactAlreadyExists);
                contacts.try_push(contact.clone())
                    .map_err(|_| Error::<T>::TooManyContacts)?;
                Ok::<(), Error<T>>(())
            })?;

            Self::deposit_event(Event::ContactAdded { user: who, contact });
            Ok(())
        }

        /// Upload encrypted health status (CID from IPFS)
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn upload_encrypted_health(
            origin: OriginFor<T>,
            cid: Vec<u8>,
            disease_id: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(UserProfiles::<T>::contains_key(&who), Error::<T>::UserNotFound);

            let cid_bounded: BoundedVec<u8, ConstU32<128>> = 
                cid.clone().try_into().map_err(|_| Error::<T>::InvalidCID)?;
            let disease_bounded: BoundedVec<u8, ConstU32<64>> = 
                disease_id.clone().try_into().map_err(|_| Error::<T>::InvalidDiseaseId)?;
            let pk_id = CurrentPublicKey::<T>::get();

            let health_status = EncryptedHealthStatus {
                cid: cid_bounded,
                disease_id: disease_bounded,
                uploaded_at: Self::current_timestamp(),
                encryption_version: 1,
                public_key_id: pk_id,
            };

            EncryptedHealthStatuses::<T>::insert(&who, health_status);

            Self::deposit_event(Event::HealthStatusUploaded { 
                who, 
                cid, 
                disease_id 
            });
            Ok(())
        }

        /// Store encrypted IVS score (called by authorized compute network)
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn store_encrypted_ivs(
            origin: OriginFor<T>,
            user: T::AccountId,
            cid: Vec<u8>,
            parameters: Vec<u8>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            ensure!(UserProfiles::<T>::contains_key(&user), Error::<T>::UserNotFound);

            let cid_bounded: BoundedVec<u8, ConstU32<128>> = 
                cid.clone().try_into().map_err(|_| Error::<T>::InvalidCID)?;
            let params_bounded: BoundedVec<u8, ConstU32<128>> = 
                parameters.try_into().map_err(|_| Error::<T>::InvalidDiseaseId)?;

            let computed_at = Self::current_timestamp();
            let ivs_record = EncryptedIVS {
                cid: cid_bounded,
                computed_at,
                parameters: params_bounded,
            };

            EncryptedIVSScores::<T>::insert(&user, ivs_record);

            Self::deposit_event(Event::IVSComputed { 
                who: user, 
                cid, 
                computed_at 
            });
            Ok(())
        }

        /// Set disease ID for this parachain (admin only, one-time)
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn set_disease_id(
            origin: OriginFor<T>,
            disease_id: Vec<u8>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            let disease_bounded: BoundedVec<u8, ConstU32<64>> = 
                disease_id.clone().try_into().map_err(|_| Error::<T>::InvalidDiseaseId)?;

            DiseaseId::<T>::put(disease_bounded);

            Self::deposit_event(Event::DiseaseIdSet { disease_id });
            Ok(())
        }

        /// Update joint public key identifier
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn update_public_key(
            origin: OriginFor<T>,
            key_id: Vec<u8>,
        ) -> DispatchResult {
            ensure_root(origin)?;

            let key_bounded: BoundedVec<u8, ConstU32<128>> = 
                key_id.clone().try_into().map_err(|_| Error::<T>::InvalidCID)?;

            CurrentPublicKey::<T>::put(key_bounded);

            Self::deposit_event(Event::PublicKeyUpdated { key_id });
            Ok(())
        }

        /// Update user profile
        #[pallet::call_index(6)]
        #[pallet::weight(10_000)]
        pub fn update_profile(
            origin: OriginFor<T>,
            metadata: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            UserProfiles::<T>::try_mutate(&who, |profile_opt| {
                let profile = profile_opt.as_mut().ok_or(Error::<T>::UserNotFound)?;
                
                let metadata_bounded: BoundedVec<u8, ConstU32<256>> = 
                    metadata.try_into().map_err(|_| Error::<T>::InvalidDiseaseId)?;
                
                profile.metadata = metadata_bounded;
                Ok::<(), Error<T>>(())
            })?;

            Self::deposit_event(Event::UserProfileUpdated { who });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Get current timestamp (block number as proxy)
        fn current_timestamp() -> u64 {
            <frame_system::Pallet<T>>::block_number().saturated_into::<u64>()
        }

        /// Get all contacts for a user
        pub fn get_user_contacts(who: &T::AccountId) -> Vec<T::AccountId> {
            Contacts::<T>::get(who).to_vec()
        }

        /// Check if user has uploaded encrypted health status
        pub fn has_health_status(who: &T::AccountId) -> bool {
            EncryptedHealthStatuses::<T>::contains_key(who)
        }

        /// Get all registered users (for iteration)
        pub fn get_all_users() -> Vec<T::AccountId> {
            UserProfiles::<T>::iter_keys().collect()
        }
    }
}
