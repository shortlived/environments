class Kpsc < Formula
  desc "KeePass Secret Cache — time-boxed encrypted secret injection"
  homepage "https://github.com/softdist/kpsc"
  version "0.0.0"
  license "MIT"

  # Reference template. CI rewrites the URLs, version, and sha256 fields on
  # each release. Do not edit by hand.

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/softdist/kpsc/releases/download/kpsc-v0.0.0/kpsc-aarch64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    else
      url "https://github.com/softdist/kpsc/releases/download/kpsc-v0.0.0/kpsc-x86_64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  def install
    if Hardware::CPU.arm?
      bin.install "kpsc-aarch64" => "kpsc"
    else
      bin.install "kpsc-x86_64" => "kpsc"
    end
  end

  test do
    system "#{bin}/kpsc", "version"
  end
end
