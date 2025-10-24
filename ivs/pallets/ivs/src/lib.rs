#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use frame_support::{pallet_prelude::*, BoundedVec};
	use frame_system::pallet_prelude::*;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: frame_system::Config {
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
		type WeightInfo: WeightInfo;
	}

	// Storage: Users registry
	#[pallet::storage]
	#[pallet::getter(fn users)]
	pub type Users<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, ()>;

	// Storage: Contact graph (bidirectional edges)
	#[pallet::storage]
	#[pallet::getter(fn contacts)]
	pub type Contacts<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<T::AccountId, ConstU32<200>>,
		ValueQuery,
	>;

	// Storage: IPFS CID for encrypted health status
	#[pallet::storage]
	#[pallet::getter(fn health_cid)]
	pub type HealthCid<T: Config> =
		StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u8, ConstU32<128>>>;

	// Storage: IPFS CID for encrypted IVS
	#[pallet::storage]
	#[pallet::getter(fn ivs_cid)]
	pub type IvsCid<T: Config> =
		StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u8, ConstU32<128>>>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		UserRegistered { who: T::AccountId },
		ContactAdded { who: T::AccountId, contact: T::AccountId },
		HealthCidSet { who: T::AccountId },
		IvsCidSet { who: T::AccountId },
	}

	#[pallet::error]
	pub enum Error<T> {
		AlreadyRegistered,
		NotRegistered,
		ContactAlreadyExists,
		TooManyContacts,
		CidTooLarge,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Register a new user in the system
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::register_user())]
		pub fn register_user(origin: OriginFor<T>) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(!Users::<T>::contains_key(&who), Error::<T>::AlreadyRegistered);

			Users::<T>::insert(&who, ());
			Self::deposit_event(Event::UserRegistered { who });
			Ok(())
		}

		/// Add a bidirectional contact relationship
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::add_contact())]
		pub fn add_contact(origin: OriginFor<T>, contact: T::AccountId) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(Users::<T>::contains_key(&who), Error::<T>::NotRegistered);
			ensure!(Users::<T>::contains_key(&contact), Error::<T>::NotRegistered);

			// Add contact to who's list
			Contacts::<T>::try_mutate(&who, |contacts| {
				if contacts.contains(&contact) {
					return Err(Error::<T>::ContactAlreadyExists);
				}
				contacts
					.try_push(contact.clone())
					.map_err(|_| Error::<T>::TooManyContacts)?;
				Ok(())
			})?;

			// Add who to contact's list (bidirectional)
			Contacts::<T>::try_mutate(&contact, |contacts| {
				if !contacts.contains(&who) {
					contacts.try_push(who.clone()).map_err(|_| Error::<T>::TooManyContacts)?;
				}
				Ok(())
			})?;

			Self::deposit_event(Event::ContactAdded { who, contact });
			Ok(())
		}

		/// Set IPFS CID for encrypted health status
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::set_health_cid())]
		pub fn set_health_cid(origin: OriginFor<T>, cid: Vec<u8>) -> DispatchResult {
			let who = ensure_signed(origin)?;
			ensure!(Users::<T>::contains_key(&who), Error::<T>::NotRegistered);

			let bounded_cid: BoundedVec<u8, ConstU32<128>> =
				cid.try_into().map_err(|_| Error::<T>::CidTooLarge)?;

			HealthCid::<T>::insert(&who, bounded_cid);
			Self::deposit_event(Event::HealthCidSet { who });
			Ok(())
		}

		/// Set IPFS CID for encrypted IVS (requires root for now)
		#[pallet::call_index(3)]
		#[pallet::weight(T::WeightInfo::set_ivs_cid())]
		pub fn set_ivs_cid(
			origin: OriginFor<T>,
			user: T::AccountId,
			cid: Vec<u8>,
		) -> DispatchResult {
			ensure_root(origin)?;

			let bounded_cid: BoundedVec<u8, ConstU32<128>> =
				cid.try_into().map_err(|_| Error::<T>::CidTooLarge)?;

			IvsCid::<T>::insert(&user, bounded_cid);
			Self::deposit_event(Event::IvsCidSet { who: user });
			Ok(())
		}
	}

	pub trait WeightInfo {
		fn register_user() -> Weight;
		fn add_contact() -> Weight;
		fn set_health_cid() -> Weight;
		fn set_ivs_cid() -> Weight;
	}

	impl WeightInfo for () {
		fn register_user() -> Weight {
			Weight::from_parts(10_000, 0)
		}
		fn add_contact() -> Weight {
			Weight::from_parts(20_000, 0)
		}
		fn set_health_cid() -> Weight {
			Weight::from_parts(15_000, 0)
		}
		fn set_ivs_cid() -> Weight {
			Weight::from_parts(15_000, 0)
		}
	}
}
