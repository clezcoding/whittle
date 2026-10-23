//! Scanner modules. Each one turns part of the disk into [`Finding`](crate::Finding)s.
//! Modules never modify anything.

pub mod caches;
pub mod dupes;
pub mod migrate;
pub mod orphans;
pub mod projects;
pub mod tidy;
